// Pure diff between freshly generated shopping items and stored ones. Never touches purchased,
// overrideQuantity, recorded or manual items; deterministic so two clients converge on the same writes.
const FIELDS = ['ingredientId', 'name', 'category', 'unit', 'requiredQuantity', 'availableAtHome'];
const bySrc = (a, b) => (a.mealId < b.mealId ? -1 : a.mealId > b.mealId ? 1 : 0);
const norm = (g) => ({
  ...Object.fromEntries(FIELDS.map((k) => [k, g[k]])),
  sourceType: 'generated', sources: [...(g.sources ?? [])].sort(bySrc), orphaned: !!g.orphaned,
});
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function planShoppingWrites(generated, existing = []) {
  const byId = new Map(existing.map((e) => [e.id, e]));
  const ids = new Set(generated.map((g) => g.id));
  const sets = []; const deletes = [];
  for (const g of generated) {
    const e = byId.get(g.id);
    if (!e) sets.push({ id: g.id, isNew: true, data: { ...norm(g), purchased: false } });
    else if (!same(norm(g), norm(e))) sets.push({ id: g.id, isNew: false, data: norm(g) });
  }
  for (const e of existing) {
    if (e.sourceType !== 'generated' || ids.has(e.id)) continue;
    if (!e.purchased) deletes.push(e.id); // no longer needed and never bought
    else if (!e.orphaned) sets.push({ id: e.id, isNew: false, data: { requiredQuantity: 0, availableAtHome: 0, sources: [], orphaned: true } }); // keep purchase history
  }
  return { sets, deletes };
}
