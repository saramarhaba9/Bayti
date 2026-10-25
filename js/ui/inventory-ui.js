import { h, field, select, modal, confirmBox, toast, safe } from './dom.js';
import { store } from '../store.js';
import { SUPPORTED_UNITS, unitGroup } from '../modules/unit-conversion.js';
import { validateName } from '../validation.js';
import { fmt } from './format.js';
import { ING_CATEGORIES, UNIT_LABELS } from '../labels.js';

const view = { q: '', cat: '' };
const catOf = (e) => store.state.ingredients.find((i) => i.id === e.ingredientId)?.category ?? 'other';

function openForm(entry) {
  const edit = !!entry;
  const units = Object.fromEntries(SUPPORTED_UNITS.filter((u) => !edit || unitGroup(u) === unitGroup(entry.unit)).map((u) => [u, UNIT_LABELS[u]])); // edit: compatible units only
  modal(edit ? 'تعديل مخزون' : 'إضافة إلى المخزون', h('div', {},
    field('المكوّن', h('input', { name: 'name', required: true, list: 'inv-list', readonly: edit, value: entry?.name ?? '' })),
    h('datalist', { id: 'inv-list' }, store.state.ingredients.map((i) => h('option', { value: i.name }))),
    field('الكمية المتوفرة', h('input', { name: 'qty', type: 'number', min: '0', step: 'any', required: true, value: entry?.quantity ?? '' })),
    field('الوحدة', select('unit', units, entry?.unit ?? 'g')),
    field('التصنيف', select('category', ING_CATEGORIES, entry ? catOf(entry) : 'other')),
    field('ملاحظات (اختياري)', h('input', { name: 'notes', value: entry?.notes ?? '' }))), {
    onSubmit: async (fd) => {
      const name = validateName(fd.get('name'), 'اسم المكوّن');
      const quantity = Number(fd.get('qty'));
      if (!Number.isFinite(quantity) || quantity < 0) throw new Error('الكمية يجب ألا تكون سالبة');
      const ingredientId = edit ? entry.ingredientId : await store.ensureIngredient(name);
      const unit = fd.get('unit');
      if (!edit && store.state.inventory.some((i) => i.id === `${ingredientId}__${unitGroup(unit)}`)) throw new Error('هذا المكوّن موجود في المخزون، استخدم زر التعديل');
      await store.api.saveInventory({ ingredientId, name: edit ? entry.name : name, quantity, unit, category: fd.get('category'), notes: fd.get('notes').trim() });
      toast('تم حفظ المخزون');
    },
  });
}

export function renderInventory(root, { inventory }) {
  const list = h('div', { class: 'grid' });
  const draw = () => {
    const rows = inventory.filter((e) => (!view.cat || catOf(e) === view.cat) && e.name.includes(view.q.trim())).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    list.replaceChildren(...(rows.length ? rows.map((e) => h('article', { class: 'card' },
      h('h3', {}, e.name), h('p', { class: 'muted' }, fmt(e.quantity, e.unit), e.notes ? ` · ${e.notes}` : ''),
      h('span', { class: 'tag' }, ING_CATEGORIES[catOf(e)] ?? 'أخرى'),
      h('div', { class: 'row' },
        h('button', { class: 'btn soft', onclick: () => openForm(e) }, 'تعديل'),
        h('button', { class: 'btn danger', onclick: safe(async () => { if (await confirmBox(`حذف "${e.name}" من المخزون؟`)) { await store.api.deleteInventory(e.id); toast('تم الحذف'); } }) }, 'حذف'))))
      : [h('p', { class: 'empty' }, inventory.length ? 'لا توجد نتائج.' : 'المخزون فارغ. أضف ما لديك في المنزل لتقليل قائمة التسوق 📦')]));
  };
  draw();
  const cat = select('cat', { '': 'كل التصنيفات', ...ING_CATEGORIES }, view.cat);
  cat.onchange = () => { view.cat = cat.value; draw(); };
  root.replaceChildren(
    h('div', { class: 'row between' }, h('h1', {}, 'مخزون المنزل'), h('button', { class: 'btn', onclick: () => openForm() }, '+ إضافة')),
    h('input', { type: 'search', 'aria-label': 'بحث في المخزون', placeholder: 'ابحث في المخزون…', value: view.q, oninput: (e) => { view.q = e.target.value; draw(); } }),
    field('التصنيف', cat), list);
}
