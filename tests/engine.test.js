import test from 'node:test';
import assert from 'node:assert/strict';
import { convert, toBase, formatQuantity } from '../js/modules/unit-conversion.js';
import { scaleIngredients, aggregate, reconcile } from '../js/modules/ingredient-aggregation.js';
import { copyWeekMeals } from '../js/modules/week-management.js';
import { addDays, weekStartSunday, parseYMD } from '../js/dates.js';

const ing = (q, u = 'g', id = 'pot') => ({ ingredientId: id, name: id, quantity: q, unit: u });
const meal = (id, name, ...i) => ({ id, recipeName: name, date: '2026-10-25', ingredientsSnapshot: i });
const week = () => [meal('m1', 'A', ing(500)), meal('m2', 'B', ing(700)), meal('m3', 'C', ing(800))];

test('1 sums repeated ingredients with sources', () => {
  const { items } = aggregate(week());
  assert.equal(items.length, 1);
  assert.equal(items[0].requiredQuantity, 2000);
  assert.equal(items[0].sources.length, 3);
});
test('2 kg → g', () => assert.equal(convert(2, 'kg', 'g'), 2000));
test('3 l → ml', () => { assert.equal(convert(1.5, 'l', 'ml'), 1500); assert.equal(toBase(2, 'l').quantity, 2000); });
test('4 incompatible units stay separate', () => {
  const { items } = aggregate([meal('m1', 'A', ing(2, 'piece'), ing(300, 'g'))]);
  assert.equal(items.length, 2);
  assert.ok(items.every((i) => i.unitConflict));
  assert.throws(() => convert(1, 'g', 'ml'));
  assert.throws(() => convert(1, 'piece', 'clove'));
});
test('5 subtracts inventory across compatible units', () => {
  const { items } = aggregate(week(), [{ ingredientId: 'pot', quantity: 0.5, unit: 'kg' }]);
  assert.equal(items[0].availableAtHome, 500);
  assert.equal(items[0].toBuy, 1500);
  assert.deepEqual(formatQuantity(items[0].toBuy, 'g'), { quantity: 1.5, unit: 'kg' });
});
test('6 never negative', () => {
  const { items } = aggregate(week(), [{ ingredientId: 'pot', quantity: 5, unit: 'kg' }]);
  assert.equal(items[0].toBuy, 0);
});
test('7 scales by servings, rejects bad servings', () => {
  assert.equal(scaleIngredients([ing(500)], 4, 6)[0].quantity, 750);
  assert.throws(() => scaleIngredients([ing(500)], 0, 6));
  assert.throws(() => scaleIngredients([ing(500)], 4, -1));
});
test('8 snapshots survive recipe edits', () => {
  const recipe = { ingredients: [ing(500)] };
  const snap = scaleIngredients(recipe.ingredients, 4, 4);
  const m = meal('m1', 'A', ...snap);
  recipe.ingredients[0].quantity = 9999;
  assert.equal(aggregate([m]).items[0].requiredQuantity, 500);
});
test('9 purchased status preserved when quantity changes', () => {
  const first = aggregate(week()).items.map((i) => ({ ...i, purchased: true }));
  const next = reconcile(aggregate([meal('m1', 'A', ing(100))]).items, first);
  assert.equal(next[0].purchased, true);
  assert.equal(next[0].requiredQuantity, 100);
});
test('10 copying a week shifts dates, new ids, resets purchased', () => {
  const src = week();
  const copy = copyWeekMeals(src, '2026-10-25', '2026-11-01', (() => { let n = 0; return () => `n${++n}`; })());
  assert.equal(copy[0].date, '2026-11-01');
  assert.notEqual(copy[0].id, src[0].id);
  assert.equal(src[0].date, '2026-10-25');
  assert.ok(reconcile(aggregate(copy).items, []).every((i) => i.purchased === false));
});
test('11 manual items survive recalculation', () => {
  const manual = { id: 'manual-1', name: 'Soap', sourceType: 'manual', purchased: false };
  assert.ok(reconcile(aggregate(week()).items, [manual]).some((i) => i.id === 'manual-1'));
});
test('11b purchased generated items kept as orphaned history, unpurchased dropped', () => {
  const old = aggregate(week()).items;
  assert.equal(reconcile([], old).length, 0);
  const kept = reconcile([], old.map((i) => ({ ...i, purchased: true })));
  assert.equal(kept[0].orphaned, true);
  assert.equal(kept[0].toBuy, 0);
});
test('12 missing recipe reference or snapshot', () => {
  const m = { ...meal('m1', 'Deleted recipe', ing(100)), recipeId: null };
  const { items } = aggregate([m, { id: 'm2', recipeName: 'X' }]);
  assert.equal(items[0].requiredQuantity, 100);
});
test('13 empty week', () => assert.deepEqual(aggregate([], []), { items: [], issues: [] }));
test('14 decimals exact', () => {
  assert.equal(aggregate([meal('m', 'A', ing(0.1), ing(0.2))]).items[0].requiredQuantity, 0.3);
});
test('15 invalid ingredients reported, no NaN output', () => {
  const { items, issues } = aggregate([meal('m', 'A', ing(NaN), ing(5, 'cup'), ing(-1), ing(10))]);
  assert.equal(issues.length, 3);
  assert.equal(items[0].requiredQuantity, 10);
});
test('18 no duplicate generated items, deterministic', () => {
  const a = aggregate(week()).items, b = aggregate(week().reverse()).items;
  assert.equal(new Set(a.map((i) => i.id)).size, a.length);
  assert.deepEqual(a.map((i) => i.id), b.map((i) => i.id));
});
test('dates: Sunday start, no timezone drift, invalid rejected', () => {
  assert.equal(weekStartSunday('2026-10-24'), '2026-10-18');
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.throws(() => parseYMD('2026-02-30'));
});
