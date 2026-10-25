import { weekStartSunday, todayYMD } from './dates.js';

// Thin UI-facing store. Data arrives from Firestore listeners (data-service) via patch();
// all writes go through the attached backend. Nothing here is authoritative.
const fresh = () => ({
  ingredients: [], recipes: [], meals: [], members: [], inventory: [], weeks: [], shopping: [],
  hid: null, uid: null, weekId: null, ready: false, weekStart: weekStartSunday(todayYMD()),
});
const state = fresh();
const sync = { pending: false, error: null };
const subs = new Set(); const syncSubs = new Set();
let backend = null;
const notify = () => subs.forEach((f) => f(state));
const need = () => { if (!backend) throw new Error('لا يوجد اتصال بالأسرة'); return backend; };

export const store = {
  state, sync,
  get api() { return need(); },
  subscribe(f) { subs.add(f); f(state); return () => subs.delete(f); },
  subscribeSync(f) { syncSubs.add(f); f(sync); return () => syncSubs.delete(f); },
  patch(p) { Object.assign(state, p); notify(); },
  setSync(p) { Object.assign(sync, p); syncSubs.forEach((f) => f(sync)); },
  attach(b) { backend = b; },
  detach() { backend?.stop(); backend = null; Object.assign(state, fresh()); Object.assign(sync, { pending: false, error: null }); notify(); },
  ensureIngredient: (n) => need().ensureIngredient(n),
  saveRecipe: (r) => need().saveRecipe(r), deleteRecipe: (id) => need().deleteRecipe(id),
  saveMeal: (m) => need().saveMeal(m), deleteMeal: (id) => need().deleteMeal(id),
};
