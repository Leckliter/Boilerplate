import { addDaysToDay, todayInAppZone } from '@app/ui/lib/dates';

/** The calendar day (YYYY-MM-DD) of an instant, in the app's time zone. */
export const dayOf = (d: Date | string | number) => todayInAppZone(new Date(d));

/** The last `n` days ending today, oldest first, as YYYY-MM-DD in the app's time zone. */
export function lastDays(n: number): string[] {
  const today = todayInAppZone();
  return Array.from({ length: n }, (_, i) => addDaysToDay(today, i - (n - 1)));
}

/** How many of `instants` fall on each of `days` (anything older or newer is ignored). */
export function countByDay(instants: (Date | string | number)[], days: string[]): number[] {
  const index = new Map(days.map((d, i) => [d, i]));
  const out = days.map(() => 0);
  for (const at of instants) {
    const i = index.get(dayOf(at));
    if (i !== undefined) out[i]!++;
  }
  return out;
}

/** Day-of-month labels ("27") for a bar chart's axis: a full date per bar would overlap. */
export const dayLabels = (days: string[]) => days.map((d) => String(Number(d.slice(8))));

/** Instants newer than this many hours ago. */
export const withinHours = (at: Date | string | number, hours: number) =>
  Date.now() - new Date(at).getTime() <= hours * 3_600_000;
