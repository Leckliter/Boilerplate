import { appTimeZone } from '../time-zone';

/**
 * Texts and pushes to customers only go out between 8am and 9pm in the app's time zone
 * (APP_TIME_ZONE; US rules for automated texts, and just polite). Anything queued outside that
 * window waits until 8am. Urgent types and staff alerts skip this.
 */
const START_HOUR = 8;
const END_HOUR = 21;

export function nextAllowedTime(now: Date): Date {
  const hour = localHour(now);
  if (hour >= START_HOUR && hour < END_HOUR) return now;
  // Step forward in 15-minute increments until it's 8:00 local (handles DST).
  const t = new Date(Math.ceil(now.getTime() / 900_000) * 900_000);
  while (localHour(t) !== START_HOUR) t.setTime(t.getTime() + 900_000);
  // Back to exactly 8:00 local.
  while (localHour(new Date(t.getTime() - 900_000)) === START_HOUR) {
    t.setTime(t.getTime() - 900_000);
  }
  return t;
}

function localHour(d: Date): number {
  return Number(
    new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hourCycle: 'h23',
      timeZone: appTimeZone(),
    }).format(d),
  );
}
