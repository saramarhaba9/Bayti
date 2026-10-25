import { clean } from './unit-conversion.js';

// Quantity the user actually needs to buy. Priority: manual override → manual item → required − available.
export const effectiveToBuy = (i) => {
  if (i.overrideQuantity != null) return Math.max(0, i.overrideQuantity);
  if (i.orphaned) return 0;
  if (i.sourceType === 'manual') return i.requiredQuantity;
  return Math.max(0, clean(i.requiredQuantity - (i.availableAtHome ?? 0)));
};
// Default list: things still to buy, plus purchased history. Items fully covered by inventory are hidden.
export const inList = (i) => effectiveToBuy(i) > 0 || !!i.purchased;
export function progress(items) {
  const base = items.filter(inList);
  const done = base.filter((i) => i.purchased).length;
  return { total: base.length, done, remaining: base.length - done };
}
