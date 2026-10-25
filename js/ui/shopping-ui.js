import { h, field, select, modal, confirmBox, toast, safe } from './dom.js';
import { store } from '../store.js';
import { effectiveToBuy, inList, progress } from '../modules/shopping-view.js';
import { clean } from '../modules/unit-conversion.js';
import { validateName } from '../validation.js';
import { fmt } from './format.js';
import { ING_CATEGORIES, UNIT_LABELS } from '../labels.js';

const view = { q: '', cat: '', purchased: true, all: false };
const tag = (t) => h('span', { class: 'tag' }, t);

function openDetails(i, all) {
  const clash = all.filter((x) => x.ingredientId && x.ingredientId === i.ingredientId && x.id !== i.id);
  let dlg;
  const go = (hash) => { dlg.close(); location.hash = hash; };
  const auto = Math.max(0, clean(i.requiredQuantity - i.availableAtHome));
  dlg = modal(i.name, h('div', {},
    h('h3', {}, 'الطبخات المساهمة'),
    h('ul', {}, i.sources.map((s) => h('li', {}, `${s.recipeName}: ${fmt(s.quantity, s.unit)}`))),
    h('p', {}, `إجمالي المطلوب: ${fmt(i.requiredQuantity, i.unit)}`),
    h('p', {}, `المتوفر في المنزل: ${fmt(i.availableAtHome, i.unit)}`),
    h('p', {}, h('strong', {}, `الكمية للشراء: ${fmt(effectiveToBuy(i), i.unit)}`)),
    i.overrideQuantity != null ? h('p', { class: 'muted' }, `عُدّلت الكمية يدويًا. المحسوب تلقائيًا: ${fmt(auto, i.unit)}`) : null,
    clash.length ? h('p', { class: 'empty' }, `تنبيه: يوجد هذا المكوّن أيضًا بوحدة غير متوافقة (${clash.map((x) => fmt(x.requiredQuantity, x.unit)).join('، ')}) فلم يُجمع معه. صحّح الوحدة في إحدى الطبخات.`) : null,
    h('div', { class: 'row' },
      h('button', { type: 'button', class: 'btn soft', onclick: () => go('#/inventory') }, 'تعديل المخزون'),
      h('button', { type: 'button', class: 'btn soft', onclick: () => go('#/planner') }, 'تعديل الطبخات'))), { cancelLabel: 'إغلاق' });
}

function openEdit(i) {
  const manual = !i || i.sourceType === 'manual';
  const num = (v) => h('input', { name: 'qty', type: 'number', min: '0', step: 'any', required: true, value: v });
  let dlg;
  const body = manual ? h('div', {},
    field('المنتج', h('input', { name: 'name', required: true, value: i?.name ?? '' })),
    field('الكمية', num(i?.requiredQuantity ?? '')),
    field('الوحدة', select('unit', UNIT_LABELS, i?.unit ?? 'piece')),
    field('التصنيف', select('category', ING_CATEGORIES, i?.category ?? 'other')))
    : h('div', {},
      h('p', { class: 'muted' }, `المحسوب تلقائيًا: ${fmt(Math.max(0, clean(i.requiredQuantity - i.availableAtHome)), i.unit)}`),
      field(`الكمية للشراء (${UNIT_LABELS[i.unit]})`, num(effectiveToBuy(i))),
      i.overrideQuantity != null ? h('button', { type: 'button', class: 'btn soft', onclick: safe(async () => { await store.api.setOverride(i.id, null); dlg.close(); toast('عاد الحساب التلقائي'); }) }, 'استعادة الحساب التلقائي') : null);
  dlg = modal(i ? 'تعديل منتج' : 'منتج جديد', body, {
    onSubmit: async (fd) => {
      const qty = Number(fd.get('qty'));
      if (!Number.isFinite(qty) || qty < 0 || (manual && qty <= 0)) throw new Error('الكمية غير صالحة');
      if (manual) await store.api.saveManualItem({ id: i?.id, name: validateName(fd.get('name'), 'اسم المنتج'), requiredQuantity: qty, unit: fd.get('unit'), category: fd.get('category') });
      else await store.api.setOverride(i.id, qty);
      toast('تم الحفظ');
    },
  });
}

export function renderShopping(root, { shopping }) {
  const p = progress(shopping);
  const list = h('div');
  const row = (i) => {
    const manual = i.sourceType === 'manual';
    const names = [...new Set(i.sources.map((s) => s.recipeName))].join('، ');
    return h('article', { class: `card item${i.purchased ? ' done' : ''}` },
      h('label', { class: 'check' },
        h('input', { type: 'checkbox', checked: i.purchased, onchange: safe(async (e) => {
          try { await store.api.setPurchased(i.id, e.target.checked); } catch (err) { e.target.checked = !e.target.checked; throw err; }
        }) }),
        h('span', {}, i.purchased ? '✓ ' : '', i.name)),
      h('p', { class: 'muted' }, manual ? `الكمية: ${fmt(i.requiredQuantity, i.unit)}`
        : `المطلوب ${fmt(i.requiredQuantity, i.unit)} · في المنزل ${fmt(i.availableAtHome, i.unit)} · للشراء ${fmt(effectiveToBuy(i), i.unit)}`),
      h('div', { class: 'row' }, tag(ING_CATEGORIES[i.category] ?? 'أخرى'), manual && tag('يدوي'), i.overrideQuantity != null && tag('كمية معدّلة'), i.orphaned && tag('لم يعد مطلوبًا')),
      names && h('p', { class: 'muted' }, `الطبخات: ${names}`),
      h('div', { class: 'row' },
        !manual && h('button', { class: 'btn', onclick: () => openDetails(i, shopping) }, 'التفاصيل'),
        !i.orphaned && h('button', { class: 'btn soft', onclick: () => openEdit(i) }, 'تعديل'),
        manual && h('button', { class: 'btn danger', onclick: safe(async () => { if (await confirmBox(`حذف "${i.name}" من القائمة؟`)) await store.api.deleteShoppingItem(i.id); }) }, 'حذف')));
  };
  const draw = () => {
    const items = shopping.filter((i) => (view.all || inList(i)) && (view.purchased || !i.purchased)
      && (!view.cat || i.category === view.cat) && i.name.includes(view.q.trim())).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    list.replaceChildren(...(items.length ? items.map(row) : [h('p', { class: 'empty' }, shopping.length ? 'لا توجد منتجات مطابقة.' : 'قائمة التسوق فارغة. خطّط لطبخة أو أضف منتجًا يدويًا 🛒')]));
  };
  draw();
  const cat = select('cat', { '': 'كل التصنيفات', ...ING_CATEGORIES }, view.cat);
  cat.onchange = () => { view.cat = cat.value; draw(); };
  const toggle = (label, key) => h('label', { class: 'check small' }, h('input', { type: 'checkbox', checked: view[key], onchange: (e) => { view[key] = e.target.checked; draw(); } }), label);
  root.replaceChildren(
    h('div', { class: 'row between' }, h('h1', {}, 'قائمة التسوق'), h('button', { class: 'btn', onclick: () => openEdit() }, '+ منتج')),
    h('p', {}, `تم شراء ${p.done} من أصل ${p.total} منتجًا`),
    h('progress', { value: p.done, max: p.total || 1, 'aria-label': 'تقدم التسوق' }),
    h('input', { type: 'search', 'aria-label': 'بحث في القائمة', placeholder: 'ابحث عن منتج…', value: view.q, oninput: (e) => { view.q = e.target.value; draw(); } }),
    field('التصنيف', cat), toggle('إظهار المشتريات', 'purchased'), toggle('إظهار ما هو متوفر بالمنزل', 'all'),
    list,
    h('button', { class: 'btn ghost', onclick: safe(async () => { toast(`تم تسجيل ${await store.api.recordPurchases()} منتجات في المخزون`); }) }, 'تسجيل المشتريات في المخزون'));
}
