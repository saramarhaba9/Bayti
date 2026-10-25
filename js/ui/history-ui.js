import { h, field, select, modal, confirmBox, toast, safe } from './dom.js';
import { store } from '../store.js';
import { addDays, diffDays } from '../dates.js';
import { progress } from '../modules/shopping-view.js';
import { DAYS, MEAL_TYPES } from '../labels.js';

const TYPES = Object.keys(MEAL_TYPES);
const sortedWeeks = () => [...store.state.weeks].sort((a, b) => b.startDate.localeCompare(a.startDate));

export function openNewWeek(copyFrom = '') {
  const from = { '': 'أسبوع فارغ', ...Object.fromEntries(sortedWeeks().map((w) => [w.id, `نسخ خطة أسبوع ${w.startDate}`])) };
  modal('أسبوع جديد', h('div', {},
    h('p', { class: 'muted' }, 'سيُؤرشف الأسبوع الحالي ويبقى كما هو دون تغيير.'),
    field('بداية الأسبوع الجديد (تُضبط على يوم الأحد)', h('input', { name: 'start', type: 'date', required: true, value: addDays(store.state.weekStart, 7) })),
    field('البدء من', select('from', from, copyFrom))), {
    submitLabel: 'ابدأ',
    onSubmit: async (fd) => {
      await store.api.startWeek({ startDate: fd.get('start'), copyFrom: fd.get('from') || null });
      toast('تم إنشاء الأسبوع');
      location.hash = '#/planner';
    },
  });
}

async function openWeek(w) {
  const { meals, items } = await store.api.loadWeek(w.id);
  const p = progress(items);
  meals.sort((a, b) => a.date.localeCompare(b.date) || TYPES.indexOf(a.mealType) - TYPES.indexOf(b.mealType));
  modal(w.title, h('div', {},
    h('p', { class: 'muted' }, `${meals.length} طبخات · تم شراء ${p.done} من أصل ${p.total} منتجًا`),
    meals.length ? h('ul', {}, meals.map((m) => h('li', {}, `${DAYS[diffDays(w.startDate, m.date)] ?? m.date} · ${MEAL_TYPES[m.mealType]} · ${m.recipeName}`)))
      : h('p', { class: 'empty' }, 'لا توجد طبخات في هذا الأسبوع')), { cancelLabel: 'إغلاق' });
}

export function renderHistory(root, { weeks }) {
  root.replaceChildren(
    h('div', { class: 'row between' }, h('h1', {}, 'الأسابيع'), h('button', { class: 'btn', onclick: () => openNewWeek() }, '+ أسبوع جديد')),
    ...sortedWeeks().map((w) => h('article', { class: 'card' },
      h('span', { class: 'tag' }, w.status === 'active' ? 'نشط' : 'مؤرشف'),
      h('h3', {}, w.title),
      h('p', { class: 'muted' }, h('bdi', {}, w.startDate), ' ← ', h('bdi', {}, w.endDate)),
      h('div', { class: 'row' },
        h('button', { class: 'btn', onclick: safe(() => openWeek(w)) }, 'عرض'),
        h('button', { class: 'btn soft', onclick: () => openNewWeek(w.id) }, 'نسخ إلى أسبوع جديد'),
        w.status !== 'active' && h('button', { class: 'btn ghost', onclick: safe(async () => { if (await confirmBox('تفعيل هذا الأسبوع؟ سيُؤرشف الأسبوع الحالي.', 'تفعيل')) { await store.api.setActiveWeek(w.id); toast('تم تفعيل الأسبوع'); } }) }, 'تفعيل'))))
    , weeks.length ? null : h('p', { class: 'empty' }, 'لا توجد أسابيع بعد'));
}
