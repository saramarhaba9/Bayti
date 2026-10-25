import { h } from './dom.js';
import { openMealForm } from './planner-ui.js';
import { openRecipeForm } from './recipes-ui.js';
import { openNewWeek } from './history-ui.js';
import { progress } from '../modules/shopping-view.js';
import { addDays } from '../dates.js';

const link = (href, text) => h('a', { class: 'btn soft', href }, text);

export function renderDashboard(root, { meals, shopping, weekStart }) {
  const p = progress(shopping);
  root.replaceChildren(
    h('h1', {}, new Date().getHours() < 12 ? 'صباح الخير ☀️' : 'مساء الخير 🌙'),
    h('p', { class: 'muted' }, 'أسبوع ', h('bdi', {}, weekStart), ' ← ', h('bdi', {}, addDays(weekStart, 6))),
    h('div', { class: 'card stat' }, 'الطبخات المخططة: ', h('strong', {}, String(meals.length))),
    h('div', { class: 'card stat' }, h('p', {}, `تم شراء ${p.done} من أصل ${p.total} منتجًا`),
      h('progress', { value: p.done, max: p.total || 1, 'aria-label': 'تقدم التسوق' }), h('p', { class: 'muted' }, `المتبقي للشراء: ${p.remaining}`)),
    meals.length ? null : h('p', { class: 'empty' }, 'لم تُخطَّط وجبات هذا الأسبوع بعد. ابدأ بإضافة أول طبخة! 🍲'),
    h('div', { class: 'row' },
      h('button', { class: 'btn', onclick: () => openMealForm() }, '🍲 إضافة طبخة'),
      h('button', { class: 'btn', onclick: () => openRecipeForm() }, '📖 إضافة وصفة'),
      link('#/shopping', '🛒 قائمة التسوق'), link('#/inventory', '📦 إدارة المخزون'),
      h('button', { class: 'btn soft', onclick: () => openNewWeek() }, '🗓️ أسبوع جديد'),
      link('#/history', '🗂️ الأسابيع السابقة')));
}
