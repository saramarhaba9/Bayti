// Timezone-safe YYYY-MM-DD helpers (all math in UTC, no locale parsing).
const RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY = 86400000;

export function parseYMD(s) {
  const m = RE.exec(s);
  if (!m) throw new RangeError(`Invalid date: ${s}`);
  const [y, mo, d] = m.slice(1).map(Number);
  const t = Date.UTC(y, mo - 1, d);
  const dt = new Date(t);
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d)
    throw new RangeError(`Invalid date: ${s}`);
  return t;
}
export const formatYMD = (t) => new Date(t).toISOString().slice(0, 10);
export const addDays = (s, n) => formatYMD(parseYMD(s) + n * DAY);
export const diffDays = (a, b) => Math.round((parseYMD(b) - parseYMD(a)) / DAY);
export const weekStartSunday = (s) => addDays(s, -new Date(parseYMD(s)).getUTCDay());
export const weekEnd = (startYMD) => addDays(startYMD, 6);
export const todayYMD = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
