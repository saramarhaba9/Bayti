import { h } from './dom.js';
import { store } from '../store.js';
import { SUPPORTED_UNITS, clean } from '../modules/unit-conversion.js';
import { UNIT_LABELS } from '../labels.js';

// Dynamic ingredient editor shared by the recipe form and the planned-meal form.
export function ingredientRows(initial = []) {
  const box = h('div');
  const add = (i = {}) => box.append(h('div', { class: 'ing-row' },
    h('input', { 'aria-label': 'اسم المكوّن', list: 'ing-list', value: i.name ?? '', placeholder: 'المكوّن' }),
    h('input', { 'aria-label': 'الكمية', type: 'number', min: '0', step: 'any', value: i.quantity ?? '' }),
    h('select', { 'aria-label': 'الوحدة' }, SUPPORTED_UNITS.map((u) => h('option', { value: u, selected: u === i.unit }, UNIT_LABELS[u]))),
    h('button', { type: 'button', class: 'btn ghost', 'aria-label': 'حذف المكوّن', onclick: (e) => e.currentTarget.parentElement.remove() }, '✕')));
  const set = (list) => { box.replaceChildren(); (list.length ? list : [{}]).forEach(add); };
  set(initial);
  const el = h('div', {}, box,
    h('datalist', { id: 'ing-list' }, store.state.ingredients.map((i) => h('option', { value: i.name }))),
    h('button', { type: 'button', class: 'btn soft', onclick: () => add() }, '+ مكوّن'));
  return {
    el, set,
    scale(ratio) { box.querySelectorAll('input[type=number]').forEach((q) => { if (q.value !== '') q.value = clean(Number(q.value) * ratio); }); },
    async read() {
      const rows = [...box.querySelectorAll('.ing-row')];
      if (!rows.length) throw new Error('يجب إضافة مكوّن واحد على الأقل');
      return Promise.all(rows.map(async (r) => {
        const [nameEl, qtyEl, unitEl] = r.querySelectorAll('input,select');
        const name = nameEl.value.trim();
        const quantity = Number(qtyEl.value);
        if (!name) throw new Error('اسم المكوّن مطلوب');
        if (!Number.isFinite(quantity) || quantity <= 0) throw new Error(`كمية "${name}" يجب أن تكون أكبر من صفر`);
        return { ingredientId: await store.ensureIngredient(name), name, quantity, unit: unitEl.value };
      }));
    },
  };
}
