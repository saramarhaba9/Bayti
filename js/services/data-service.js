import { db } from '../firebase-config.js';
import { collection, doc, onSnapshot, setDoc, updateDoc, getDocs, deleteDoc, writeBatch, runTransaction, increment, serverTimestamp } from '../firebase-sdk.js';
import { store } from '../store.js';
import { addDays, weekStartSunday, todayYMD } from '../dates.js';
import { aggregate } from '../modules/ingredient-aggregation.js';
import { planShoppingWrites } from '../modules/shopping-sync.js';
import { effectiveToBuy } from '../modules/shopping-view.js';
import { copyWeekMeals } from '../modules/week-management.js';
import { convert, unitGroup } from '../modules/unit-conversion.js';

const strip = ({ id, createdAt, updatedAt, ...rest }) => rest;
const mapDocs = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
const normName = (s) => s.trim().replace(/\s+/g, ' ').toLowerCase();
const byStartDesc = (a, b) => b.startDate.localeCompare(a.startDate);
const TOTAL = 7; // ingredients, recipes, members, inventory, weeks, meals, shopping
const now = serverTimestamp;

// Firestore is the single source of truth. Listeners feed the store; writes are targeted.
export async function connect(hid, uid) {
  const col = (...p) => collection(db, 'households', hid, ...p);
  const ref = (...p) => doc(db, 'households', hid, ...p);
  const first = new Set(); const pend = {}; const subs = {};
  let lastSig = ''; let lastAt = 0; let weekId = null; let timer = null; let busy = false; let again = false; let dead = false;
  const sref = (id) => ref('weeks', weekId, 'shoppingItems', id);
  const syncErr = () => store.setSync({ error: '⚠️ تعذّرت المزامنة' });

  const watch = (name, q, after) => onSnapshot(q, { includeMetadataChanges: true },
    (snap) => {
      pend[name] = snap.metadata.hasPendingWrites;
      store.setSync({ pending: Object.values(pend).some(Boolean), error: null });
      if (!(first.has(name) && !snap.docChanges().length)) { // skip metadata-only updates
        first.add(name);
        store.patch({ [name]: mapDocs(snap), ready: first.size === TOTAL });
      }
      after?.(snap);
    }, syncErr);

  const watchWeek = (id) => { // meals + shopping follow the active week
    subs.meals?.(); subs.shopping?.();
    first.delete('meals'); first.delete('shopping'); delete pend.meals; delete pend.shopping;
    store.patch({ meals: [], shopping: [], ready: false });
    subs.meals = watch('meals', col('weeks', id, 'meals'));
    subs.shopping = watch('shopping', col('weeks', id, 'shoppingItems'));
  };

  const weekDoc = (start, status) => ({ title: `أسبوع ${start}`, startDate: start, endDate: addDays(start, 6), status, createdAt: now(), updatedAt: now() });
  const setActiveWeek = async (id) => { // atomically: exactly one active week
    const batch = writeBatch(db);
    for (const w of store.state.weeks) {
      if (w.id === id && w.status !== 'active') batch.update(ref('weeks', w.id), { status: 'active', updatedAt: now() });
      if (w.id !== id && w.status === 'active') batch.update(ref('weeks', w.id), { status: 'archived', updatedAt: now() });
    }
    await batch.commit();
  };
  const onWeeks = (snap) => {
    const weeks = [...store.state.weeks].sort(byStartDesc);
    const active = weeks[0] && weeks.find((w) => w.status === 'active');
    if (!active) {
      if (snap.metadata.fromCache) return; // wait for the server before creating anything
      if (weeks.length) setActiveWeek(weeks[0].id).catch(syncErr);
      else { const s = weekStartSunday(todayYMD()); setDoc(ref('weeks', s), weekDoc(s, 'active')).catch(syncErr); } // stable ID → idempotent
      return;
    }
    if (active.id !== weekId) { weekId = active.id; store.patch({ weekId, weekStart: active.startDate }); watchWeek(weekId); }
  };

  // Keep generated shopping items in step with meals + inventory (idempotent diff, debounced).
  async function syncShopping() {
    const s = store.state;
    if (dead || !s.ready || !weekId) return;
    if (busy) { again = true; return; }
    busy = true;
    try {
      const cat = new Map(s.ingredients.map((i) => [i.id, i.category]));
      const gen = aggregate(s.meals, s.inventory).items.map((g) => ({ ...g, category: cat.get(g.ingredientId) ?? 'other' }));
      const plan = planShoppingWrites(gen, s.shopping);
      const { sets, deletes } = plan;
      const sig = JSON.stringify(plan);
      // Safety brake: never re-send an identical plan within 60 s (prevents runaway writes / quota burn).
      if ((sets.length || deletes.length) && !(sig === lastSig && Date.now() - lastAt < 60000)) {
        lastSig = sig; lastAt = Date.now();
        const batch = writeBatch(db);
        for (const { id, data, isNew } of sets) batch.set(sref(id), { ...data, updatedAt: now(), ...(isNew && { createdAt: now() }) }, { merge: true });
        deletes.forEach((id) => batch.delete(sref(id)));
        await batch.commit();
      }
    } catch { store.setSync({ error: '⚠️ تعذّر تحديث قائمة التسوق' }); }
    busy = false;
    if (again) { again = false; timer = setTimeout(syncShopping, 400); }
  }

  store.patch({ hid, uid });
  subs.ingredients = watch('ingredients', col('ingredients'));
  subs.recipes = watch('recipes', col('recipes'));
  subs.members = watch('members', col('members'));
  subs.inventory = watch('inventory', col('inventory'));
  subs.weeks = watch('weeks', col('weeks'), onWeeks);
  subs.sync = store.subscribe(() => { clearTimeout(timer); timer = setTimeout(syncShopping, 400); });

  const save = async (colRef, rec) => {
    const r = rec.id ? doc(colRef, rec.id) : doc(colRef);
    await setDoc(r, { ...strip(rec), ...(!rec.id && { createdAt: now() }), updatedAt: now() }, { merge: true });
    return { ...strip(rec), id: r.id };
  };

  return {
    stop() { dead = true; clearTimeout(timer); Object.values(subs).forEach((s) => s?.()); },
    async ensureIngredient(name) {
      const normalizedName = normName(name);
      const found = store.state.ingredients.find((i) => i.normalizedName === normalizedName);
      if (found) return found.id;
      const id = `i_${normalizedName.replaceAll('/', '-')}`; // deterministic → concurrent creates can't duplicate
      await setDoc(ref('ingredients', id), { name: name.trim(), normalizedName, category: 'other', createdAt: now(), updatedAt: now() }, { merge: true });
      return id;
    },
    saveRecipe: (r) => save(col('recipes'), r),
    deleteRecipe: (id) => deleteDoc(ref('recipes', id)),
    saveMeal: (m) => save(col('weeks', weekId, 'meals'), m),
    deleteMeal: (id) => deleteDoc(ref('weeks', weekId, 'meals', id)),

    // Shopping: targeted single-field updates only.
    setPurchased: (id, purchased) => updateDoc(sref(id), { purchased, updatedAt: now() }),
    setOverride: (id, qty) => updateDoc(sref(id), { overrideQuantity: qty, updatedAt: now() }),
    deleteShoppingItem: (id) => deleteDoc(sref(id)),
    saveManualItem(it) {
      const data = { name: it.name, category: it.category, requiredQuantity: it.requiredQuantity, unit: it.unit };
      if (it.id) return updateDoc(sref(it.id), { ...data, updatedAt: now() });
      return setDoc(doc(col('weeks', weekId, 'shoppingItems')), { ...data, ingredientId: null, availableAtHome: 0, purchased: false, sources: [], sourceType: 'manual', createdAt: now(), updatedAt: now() });
    },
    // Optional: add purchased quantities to inventory once per item (`recorded` prevents double counting).
    async recordPurchases() {
      const s = store.state; const batch = writeBatch(db); let n = 0;
      for (const it of s.shopping) {
        const qty = effectiveToBuy(it);
        if (!it.purchased || it.recorded || !it.ingredientId || !(qty > 0)) continue;
        const group = unitGroup(it.unit);
        const unit = s.inventory.find((i) => i.ingredientId === it.ingredientId && unitGroup(i.unit) === group)?.unit ?? it.unit;
        batch.set(ref('inventory', `${it.ingredientId}__${group}`), { ingredientId: it.ingredientId, name: it.name, unit, quantity: increment(convert(qty, it.unit, unit)), updatedAt: now() }, { merge: true });
        batch.update(sref(it.id), { recorded: true, updatedAt: now() });
        n++;
      }
      if (!n) throw new Error('لا توجد مشتريات جديدة لتسجيلها');
      await batch.commit();
      return n;
    },

    // Inventory: one entry per ingredient + unit group.
    async saveInventory(e) {
      const batch = writeBatch(db);
      batch.set(ref('inventory', `${e.ingredientId}__${unitGroup(e.unit)}`), { ingredientId: e.ingredientId, name: e.name, quantity: e.quantity, unit: e.unit, notes: e.notes ?? '', updatedAt: now() }, { merge: true });
      batch.set(ref('ingredients', e.ingredientId), { category: e.category, updatedAt: now() }, { merge: true });
      await batch.commit();
    },
    deleteInventory: (id) => deleteDoc(ref('inventory', id)),

    // Weeks
    setActiveWeek,
    async loadWeek(id) {
      const [m, i] = await Promise.all([getDocs(col('weeks', id, 'meals')), getDocs(col('weeks', id, 'shoppingItems'))]);
      return { meals: mapDocs(m), items: mapDocs(i) };
    },
    async startWeek({ startDate, copyFrom }) {
      let start;
      try { start = weekStartSunday(startDate); } catch { throw new Error('تاريخ غير صالح'); }
      let meals = [];
      if (copyFrom) {
        const src = store.state.weeks.find((w) => w.id === copyFrom);
        if (!src) throw new Error('الأسبوع المصدر غير موجود');
        meals = copyWeekMeals(mapDocs(await getDocs(col('weeks', copyFrom, 'meals'))), src.startDate, start, () => doc(col('weeks', start, 'meals')).id);
      }
      await runTransaction(db, async (tx) => {
        if ((await tx.get(ref('weeks', start))).exists()) throw new Error('هذا الأسبوع موجود بالفعل');
        store.state.weeks.filter((w) => w.status === 'active').forEach((w) => tx.update(ref('weeks', w.id), { status: 'archived', updatedAt: now() }));
        tx.set(ref('weeks', start), weekDoc(start, 'active'));
        meals.forEach((m) => tx.set(ref('weeks', start, 'meals', m.id), { ...strip(m), createdAt: now(), updatedAt: now() }));
      });
      return start; // shopping items for the new week are generated fresh (purchased = false)
    },
  };
}
