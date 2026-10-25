import { h, field, select, modal, confirmBox, toast, safe } from './dom.js';
import { ingredientRows } from './ingredient-rows.js';
import { openRecipeForm, openRecipeDetail } from './recipes-ui.js';
import { store } from '../store.js';
import { addDays, todayYMD } from '../dates.js';
import { DAYS, MEAL_TYPES } from '../labels.js';

const TYPE_ORDER = Object.keys(MEAL_TYPES);

// Add (recipeId/date preset) or edit (meal) a planned meal. Ingredients are an editable snapshot:
// changing servings rescales them by newServings/oldServings; the saved recipe is never modified.
export function openMealForm({ meal, recipeId, date } = {}) {
  const { recipes, weekStart } = store.state;
  if (!meal && !recipes.length) return openRecipeForm({}, (s) => openMealForm({ recipeId: s.id, date }));
  const recipe = recipes.find((r) => r.id === (meal?.recipeId ?? recipeId));
  const days = DAYS.map((_, i) => addDays(weekStart, i));
  const dflt = meal?.date ?? date ?? (days.includes(todayYMD()) ? todayYMD() : days[0]);
  const rows = ingredientRows(meal?.ingredientsSnapshot ?? recipe?.ingredients ?? []);
  let prev = meal?.servings ?? recipe?.defaultServings ?? 1;
  const serv = h('input', {
    name: 'servings', type: 'number', min: '0.1', step: 'any', required: true, value: prev,
    oninput: () => { const s = Number(serv.value); if (s > 0 && prev > 0) { rows.scale(s / prev); prev = s; } },
  });
  const pick = h('select', {
    name: 'recipe', required: true,
    onchange: () => { const r = recipes.find((x) => x.id === pick.value); if (r) { prev = r.defaultServings; serv.value = prev; rows.set(r.ingredients); } },
  }, h('option', { value: '' }, 'اختر وصفة…'), recipes.map((r) => h('option', { value: r.id, selected: r.id === recipe?.id }, r.name)));
  let dlg;
  const body = h('div', {},
    meal ? h('p', {}, h('strong', {}, meal.recipeName)) : [
      field('الوصفة', pick),
      h('button', { type: 'button', class: 'btn soft', onclick: () => { dlg.close(); openRecipeForm({}, (s) => openMealForm({ recipeId: s.id, date: dflt })); } }, '+ وصفة جديدة')],
    field('اليوم', h('select', { name: 'date' }, days.map((d, i) => h('option', { value: d, selected: d === dflt }, `${DAYS[i]} ${d}`)))),
    field('الوجبة', select('mealType', MEAL_TYPES, meal?.mealType ?? 'dinner')),
    field('عدد الحصص', serv),
    h('fieldset', {}, h('legend', {}, 'مكوّنات هذه الطبخة (لا تغيّر الوصفة الأصلية)'), rows.el));
  dlg = modal(meal ? 'تعديل طبخة' : 'إضافة طبخة', body, {
    onSubmit: async (fd) => {
      const src = meal ? { id: meal.recipeId, name: meal.recipeName } : recipes.find((x) => x.id === fd.get('recipe'));
      const servings = Number(fd.get('servings'));
      if (!src) throw new Error('اختر وصفة أولًا');
      if (!Number.isFinite(servings) || servings <= 0) throw new Error('عدد الحصص يجب أن يكون أكبر من صفر');
      await store.saveMeal({
        ...meal, recipeId: src.id ?? null, recipeName: src.name, date: fd.get('date'),
        mealType: fd.get('mealType'), servings, ingredientsSnapshot: await rows.read(),
      });
      toast('تم حفظ الطبخة');
    },
  });
}

async function removeMeal(m) {
  if (await confirmBox(`حذف "${m.recipeName}" من الخطة؟`)) { await store.deleteMeal(m.id); toast('تم حذف الطبخة'); }
}

const mealCard = (m, hasRecipe) => h('article', { class: 'card' },
  h('span', { class: 'tag' }, MEAL_TYPES[m.mealType]),
  h('h3', {}, m.recipeName),
  h('p', { class: 'muted' }, `${m.servings} حصص · ${m.ingredientsSnapshot.length} مكوّنات`),
  h('div', { class: 'row' },
    hasRecipe && h('button', { class: 'btn', onclick: () => openRecipeDetail(m.recipeId) }, 'عرض الوصفة'),
    h('button', { class: 'btn soft', onclick: () => openMealForm({ meal: m }) }, 'تعديل'),
    h('button', { class: 'btn danger', onclick: safe(() => removeMeal(m)) }, 'حذف')));

export function renderPlanner(root, { meals, recipes, weekStart }) {
  const ids = new Set(recipes.map((r) => r.id));
  root.replaceChildren(
    h('h1', {}, 'طبخات الأسبوع'),
    h('p', { class: 'muted' }, h('bdi', {}, weekStart), ' ← ', h('bdi', {}, addDays(weekStart, 6))),
    ...DAYS.map((name, i) => {
      const date = addDays(weekStart, i);
      const ms = meals.filter((m) => m.date === date).sort((a, b) => TYPE_ORDER.indexOf(a.mealType) - TYPE_ORDER.indexOf(b.mealType));
      return h('section', { class: 'day' },
        h('div', { class: 'row between' }, h('h2', {}, name, ' · ', h('bdi', {}, date)),
          h('button', { class: 'btn soft', onclick: () => openMealForm({ date }) }, '+ إضافة')),
        ms.length ? ms.map((m) => mealCard(m, ids.has(m.recipeId))) : h('p', { class: 'muted' }, 'لا توجد طبخات'));
    }));
}
