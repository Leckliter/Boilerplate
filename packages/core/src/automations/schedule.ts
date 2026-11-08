import type { Trigger } from './definition';

import { appTimeZone } from '../time-zone';

/** A daily run that was missed (e.g. the cron was down) still starts within this window. */
const CATCH_UP_MS = 60 * 60_000;

type ScheduleTrigger = Extract<Trigger, { type: 'schedule' }>;

/**
 * Which schedule slot is due right now, as a stable key (`every:15:1934721`,
 * `daily:2026-11-02`), or null. One run per automation + slot (a unique
 * index), so calling this every minute — or twice at once — starts one run.
 */
export function dueSlot(trigger: ScheduleTrigger, now: Date): string | null {
  if (trigger.everyMinutes) {
    return `every:${trigger.everyMinutes}:${Math.floor(now.getTime() / (trigger.everyMinutes * 60_000))}`;
  }
  if (!trigger.dailyAt) return null;
  const local = localParts(now);
  if (trigger.weekdays && !trigger.weekdays.includes(local.weekday)) return null;
  const [h, m] = trigger.dailyAt.split(':').map(Number) as [number, number];
  const sinceMs = ((local.hour - h) * 60 + (local.minute - m)) * 60_000;
  if (sinceMs < 0 || sinceMs >= CATCH_UP_MS) return null;
  return `daily:${local.date}`;
}

function localParts(d: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: appTimeZone(),
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: 'numeric',
      minute: 'numeric',
      hourCycle: 'h23',
      weekday: 'short',
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: weekdays.indexOf(parts.weekday!) + 1,
  };
}
