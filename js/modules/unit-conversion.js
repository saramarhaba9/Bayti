// Safe unit conversion. Only same-group units convert; count units never mix.
const UNITS = {
  g: { group: 'weight', factor: 1 }, kg: { group: 'weight', factor: 1000 },
  ml: { group: 'volume', factor: 1 }, l: { group: 'volume', factor: 1000 },
  piece: { group: 'count:piece', factor: 1 }, clove: { group: 'count:clove', factor: 1 },
  slice: { group: 'count:slice', factor: 1 }, pack: { group: 'count:pack', factor: 1 },
  bottle: { group: 'count:bottle', factor: 1 }, can: { group: 'count:can', factor: 1 },
};
export const SUPPORTED_UNITS = Object.keys(UNITS);
export const clean = (n) => Math.round(n * 1e9) / 1e9; // kills float noise, keeps fractions

export const isValidUnit = (u) => typeof u === 'string' && Object.hasOwn(UNITS, u);
export const unitGroup = (u) => (isValidUnit(u) ? UNITS[u].group : null);

export function baseUnitOf(group) {
  if (group === 'weight') return 'g';
  if (group === 'volume') return 'ml';
  return group.split(':')[1];
}

export function toBase(quantity, unit) {
  if (!isValidUnit(unit)) throw new RangeError(`Invalid unit: ${unit}`);
  const { group, factor } = UNITS[unit];
  return { group, quantity: clean(quantity * factor), unit: baseUnitOf(group) };
}

export function convert(quantity, from, to) {
  if (!isValidUnit(from) || !isValidUnit(to)) throw new RangeError('Invalid unit');
  if (UNITS[from].group !== UNITS[to].group) throw new RangeError(`Incompatible units: ${from} → ${to}`);
  return clean((quantity * UNITS[from].factor) / UNITS[to].factor);
}

// Display helper: 1500 g → 1.5 kg
export function formatQuantity(quantity, unit) {
  if (unit === 'g' && quantity >= 1000) return { quantity: clean(quantity / 1000), unit: 'kg' };
  if (unit === 'ml' && quantity >= 1000) return { quantity: clean(quantity / 1000), unit: 'l' };
  return { quantity: clean(quantity), unit };
}
