import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregate } from '../js/modules/ingredient-aggregation.js';
import { planShoppingWrites } from '../js/modules/shopping-sync.js';
import { effectiveToBuy, progress } from '../js/modules/shopping-view.js';

const meal = (id, q) => ({ id, recipeName: id, ingredientsSnapshot: [{ ingredientId: 'pot', name: 'pot', quantity: q, unit: 'g' }] });
const gen = (...m) => aggregate(m).items;
const apply = (existing, plan) => { // simulates Firestore merge semantics
  const m = new Map(existing.map((e) => [e.id, e]));
  plan.deletes.forEach((id) => m.delete(id));
  plan.sets.forEach(({ id, data }) => m.set(id, { ...m.get(id), ...data, id }));
  return [...m.values()];
};

test('new generated items are created unpurchased', () => {
  const { sets } = planShoppingWrites(gen(meal('a', 500)), []);
  assert.equal(sets.length, 1);
  assert.deepEqual([sets[0].isNew, sets[0].data.purchased], [true, false]);
});
test('sync is idempotent (no duplicate or repeated writes)', () => {
  const g = gen(meal('a', 500));
  const stored = apply([], planShoppingWrites(g, []));
  const again = planShoppingWrites(g, stored);
  assert.deepEqual([again.sets.length, again.deletes.length], [0, 0]);
});
test('quantity change keeps purchased status and manual override', () => {
  const stored = apply([], planShoppingWrites(gen(meal('a', 500)), [])).map((e) => ({ ...e, purchased: true, overrideQuantity: 3 }));
  const plan = planShoppingWrites(gen(meal('a', 900)), stored);
  assert.equal(plan.sets.length, 1);
  assert.ok(!('purchased' in plan.sets[0].data) && !('overrideQuantity' in plan.sets[0].data));
  const next = apply(stored, plan)[0];
  assert.deepEqual([next.purchased, next.overrideQuantity, next.requiredQuantity], [true, 3, 900]);
});
test('manual items are never touched', () => {
  const plan = planShoppingWrites([], [{ id: 'm1', sourceType: 'manual', name: 'soap', purchased: false }]);
  assert.deepEqual([plan.sets.length, plan.deletes.length], [0, 0]);
});
test('removed items: unpurchased deleted, purchased kept as history', () => {
  const stored = apply([], planShoppingWrites(gen(meal('a', 500)), []));
  assert.deepEqual(planShoppingWrites([], stored).deletes, [stored[0].id]);
  const bought = stored.map((e) => ({ ...e, purchased: true }));
  const plan = planShoppingWrites([], bought);
  assert.equal(plan.deletes.length, 0);
  const kept = apply(bought, plan);
  assert.equal(kept[0].orphaned, true);
  assert.equal(planShoppingWrites([], kept).sets.length, 0);
});
test('effective quantity and progress', () => {
  const g = { sourceType: 'generated', requiredQuantity: 2000, availableAtHome: 500 };
  assert.equal(effectiveToBuy(g), 1500);
  assert.equal(effectiveToBuy({ ...g, overrideQuantity: 3 }), 3);
  assert.equal(effectiveToBuy({ ...g, orphaned: true }), 0);
  assert.equal(effectiveToBuy({ sourceType: 'manual', requiredQuantity: 2 }), 2);
  const items = [
    { ...g, availableAtHome: 2000 },               // covered by inventory → hidden
    { ...g, purchased: true },
    { sourceType: 'manual', requiredQuantity: 2, purchased: false },
  ];
  assert.deepEqual(progress(items), { total: 2, done: 1, remaining: 1 });
});
