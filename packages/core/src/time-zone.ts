/**
 * The app's time zone (`APP_TIME_ZONE`, default America/Chicago): where "8am", "quiet hours" and
 * "daily at 08:30" are counted. Dates are stored in UTC; only these rules look at the clock on the
 * wall. The UI formats dates with `@app/ui/lib/dates` (same variable).
 */
export const DEFAULT_TIME_ZONE = 'America/Chicago';

export function appTimeZone(): string {
  const configured = process.env.APP_TIME_ZONE?.trim();
  if (!configured) return DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: configured });
    return configured;
  } catch {
    // Expected: a mistyped zone name must not take scheduling down; fall back to the default.
    return DEFAULT_TIME_ZONE;
  }
}
