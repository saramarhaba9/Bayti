// Pure, UI-independent aggregation engine. Deterministic for the same input.
import { toBase, isValidUnit, clean } from './unit-conversion.js';

export function scaleIngredients(ingredients, defaultServings, servings) {
  if (![defaultServings, servings].every((n) => Number.isFinite(n) && n > 0))
    throw new RangeError('Servings must be positive numbers');
  return ingredients.map((i) => ({ ...i, quantity: clean((i.quantity * servings) / defaultServings) }));
}

const validIng = (i) =>
  i && i.ingredientId && isValidUnit(i.unit) && Number.isFinite(i.quantity) && i.quantity >= 0;

// meals: [{id, recipeName, ingredientsSnapshot}], inventory: [{ingredientId, quantity, unit}]
export function aggregate(meals = [], inventory = []) {
  const groups = new Map();
  const issues = [];

  for (const meal of meals) {
    for (const ing of meal.ingredientsSnapshot ?? []) {
      if (!validIng(ing)) { issues.push({ mealId: meal.id, name: ing?.name ?? null, reason: 'invalid-ingredient' }); continue; }
      const b = toBase(ing.quantity, ing.unit);
      const id = `${ing.ingredientId}__${b.group}`;
      const g = groups.get(id) ?? {
        id, ingredientId: ing.ingredientId, name: ing.name, category: ing.category ?? 'other',
        group: b.group, unit: b.unit, requiredQuantity: 0, sources: [],
      };
      g.requiredQuantity = clean(g.requiredQuantity + b.quantity);
      g.sources.push({ mealId: meal.id, recipeName: meal.recipeName, quantity: ing.quantity, unit: ing.unit });
      groups.set(id, g);
    }
  }

  const available = new Map();
  for (const inv of inventory) {
    if (!validIng(inv)) continue;
    const b = toBase(inv.quantity, inv.unit);
    const id = `${inv.ingredientId}__${b.group}`;
    available.set(id, clean((available.get(id) ?? 0) + b.quantity));
  }

  const perIngredient = new Map();
  for (const g of groups.values()) perIngredient.set(g.ingredientId, (perIngredient.get(g.ingredientId) ?? 0) + 1);

  const items = [...groups.values()]
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .map((g) => {
      const availableAtHome = available.get(g.id) ?? 0;
      return {
        ...g, availableAtHome,
        toBuy: Math.max(0, clean(g.requiredQuantity - availableAtHome)),
        unitConflict: perIngredient.get(g.ingredientId) > 1,
        sourceType: 'generated', purchased: false,
      };
    });
  return { items, issues };
}

// Merge freshly generated items with the stored list without losing user data.
export function reconcile(generated, existing = []) {
  const byId = new Map(existing.map((e) => [e.id, e]));
  const out = generated.map((g) => ({ ...g, purchased: byId.get(g.id)?.purchased ?? false }));
  const ids = new Set(generated.map((g) => g.id));
  for (const e of existing) {
    if (ids.has(e.id)) continue;
    if (e.sourceType === 'manual') out.push(e);
    else if (e.purchased) out.push({ ...e, requiredQuantity: 0, toBuy: 0, sources: [], orphaned: true });
  }
  return out;
}
