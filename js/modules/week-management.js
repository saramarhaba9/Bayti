import { addDays, diffDays } from '../dates.js';

// Copy meals into a new week: new IDs, shifted dates, deep-cloned snapshots. Original untouched.
export function copyWeekMeals(meals, fromStart, toStart, newId) {
  const offset = diffDays(fromStart, toStart);
  return meals.map((m) => ({ ...structuredClone(m), id: newId(), date: addDays(m.date, offset) }));
}
