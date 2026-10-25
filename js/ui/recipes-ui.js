import { h, field, select, modal, confirmBox, toast, safe } from './dom.js';
import { ingredientRows } from './ingredient-rows.js';
import { openMealForm } from './planner-ui.js';
import { store } from '../store.js';
import { clean } from '../modules/unit-conversion.js';
import { CATEGORIES, UNIT_LABELS } from '../labels.js';

const view = { q: '', cat: '' };

export function openRecipeForm(recipe = {}, onSaved) {
  const rows = ingredientRows(recipe.ingredients ?? []);
  const body = h('div', {},
    field('اسم الوصفة', h('input', { name: 'name', required: true, value: recipe.name ?? '' })),
    field('الوصف', h('textarea', { name: 'description', rows: 2 }, recipe.description ?? '')),
    field('التصنيف', select('category', CATEGORIES, recipe.category ?? 'other')),
    field('عدد الحصص الافتراضي', h('input', { name: 'servings', type: 'number', min: '0.1', step: 'any', required: true, value: recipe.defaultServings ?? 4 })),
    field('رابط صورة (اختياري)', h('input', { name: 'image', type: 'url', value: recipe.imageUrl ?? '' })),
    h('fieldset', {}, h('legend', {}, 'المكوّنات'), rows.el),
    field('طريقة التحضير (خطوة في كل سطر)', h('textarea', { name: 'steps', rows: 4 }, (recipe.instructions ?? []).map((s) => s.text).join('\n'))));
  modal(recipe.id ? 'تعديل وصفة' : 'وصفة جديدة', body, {
    onSubmit: async (fd) => {
      const name = fd.get('name').trim();
      const servings = Number(fd.get('servings'));
      if (!name) throw new Error('اسم الوصفة مطلوب');
      if (!Number.isFinite(servings) || servings <= 0) throw new Error('عدد الحصص يجب أن يكون أكبر من صفر');
      const saved = await store.saveRecipe({
        ...recipe, name, description: fd.get('description').trim(), category: fd.get('category'),
        defaultServings: servings, imageUrl: fd.get('image').trim() || null, ingredients: await rows.read(),
        instructions: fd.get('steps').split('\n').map((t) => t.trim()).filter(Boolean).map((text, i) => ({ step: i + 1, text })),
      });
      toast('تم حفظ الوصفة');
      onSaved?.(saved);
    },
  });
}

export function openRecipeDetail(id) {
  const r = store.state.recipes.find((x) => x.id === id);
  if (!r) return toast('هذه الوصفة محذوفة', true);
  let dlg;
  const body = h('div', {},
    r.imageUrl && h('img', { class: 'cover', src: r.imageUrl, alt: '' }),
    h('p', { class: 'muted' }, `${CATEGORIES[r.category]} · ${r.defaultServings} حصص`),
    r.description && h('p', {}, r.description),
    h('h3', {}, 'المكوّنات'),
    h('ul', {}, r.ingredients.map((i) => h('li', {}, `${clean(i.quantity)} ${UNIT_LABELS[i.unit]} ${i.name}`))),
    r.instructions.length ? [h('h3', {}, 'طريقة التحضير'), h('ol', {}, r.instructions.map((s) => h('li', {}, s.text)))] : null,
    h('button', { type: 'button', class: 'btn', onclick: () => { dlg.close(); openMealForm({ recipeId: r.id }); } }, 'إضافة إلى خطة الأسبوع'));
  dlg = modal(r.name, body, { cancelLabel: 'إغلاق' });
}

async function removeRecipe(r) {
  if (await confirmBox(`حذف الوصفة "${r.name}"؟ ستبقى الطبخات المخططة سابقًا كما هي.`)) {
    await store.deleteRecipe(r.id);
    toast('تم حذف الوصفة');
  }
}

const card = (r) => h('article', { class: 'card' },
  r.imageUrl && h('img', { class: 'cover', src: r.imageUrl, alt: '', loading: 'lazy' }),
  h('h3', {}, r.name),
  h('p', { class: 'muted' }, `${CATEGORIES[r.category]} · ${r.defaultServings} حصص · ${r.ingredients.length} مكوّنات`),
  h('div', { class: 'row' },
    h('button', { class: 'btn', onclick: () => openRecipeDetail(r.id) }, 'عرض'),
    h('button', { class: 'btn soft', onclick: () => openRecipeForm(r) }, 'تعديل'),
    h('button', { class: 'btn danger', onclick: safe(() => removeRecipe(r)) }, 'حذف')));

export function renderRecipes(root, { recipes }) {
  const list = h('div', { class: 'grid' });
  const draw = () => {
    const rs = recipes.filter((r) => (!view.cat || r.category === view.cat) && r.name.includes(view.q.trim()));
    list.replaceChildren(...(rs.length ? rs.map(card) : [h('p', { class: 'empty' }, recipes.length ? 'لا توجد وصفات مطابقة للبحث.' : 'لا توجد وصفات بعد. أضف أول وصفة! 📖')]));
  };
  draw();
  const cat = select('cat', { '': 'كل التصنيفات', ...CATEGORIES }, view.cat);
  cat.onchange = () => { view.cat = cat.value; draw(); };
  root.replaceChildren(
    h('div', { class: 'row between' }, h('h1', {}, 'الوصفات'), h('button', { class: 'btn', onclick: () => openRecipeForm() }, '+ وصفة جديدة')),
    h('input', { type: 'search', 'aria-label': 'بحث في الوصفات', placeholder: 'ابحث عن وصفة…', value: view.q, oninput: (e) => { view.q = e.target.value; draw(); } }),
    field('التصنيف', cat), list);
}
