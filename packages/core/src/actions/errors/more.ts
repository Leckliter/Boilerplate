import { and, eq, errorEvents, gte, inArray, isNull, or, sql, type Tx } from '@app/db';
import { z } from 'zod';

import { appTimeZone } from '../../time-zone';
import { ActionError, defineAction } from '../define';

const REF = z
  .string()
  .trim()
  .min(4)
  .describe('The error reference people see, e.g. "E-7K3QX9MD" (or a Next.js error digest).');

/** The error rows for these references (an `E-…` ref or a Next.js digest), keyed by what was asked. */
async function findByRefs(tx: Tx, refs: string[]) {
  const upper = refs.map((r) => r.toUpperCase());
  return tx
    .select({
      id: errorEvents.id,
      fingerprint: errorEvents.fingerprint,
      ref: errorEvents.ref,
      digest: errorEvents.digest,
    })
    .from(errorEvents)
    .where(or(inArray(errorEvents.ref, upper), inArray(errorEvents.digest, refs)));
}

export const resolveManyErrors = defineAction({
  name: 'errors.resolveMany',
  title: 'Mark several errors fixed',
  description:
    'Mark many bugs fixed at once: for each reference, every open occurrence with the same fingerprint is ' +
    'closed with your note (the same as errors.resolve, in one transaction). References that do not exist are ' +
    'listed in `notFound` and skipped; if none exist it fails. Say what fixed them (commit, PR link).',
  audience: 'errors.manage',
  mutates: true,
  returns: '{ resolved: number, groups: number, notFound: string[] }',
  input: z.object({
    refs: z.array(REF).min(1).max(100).describe('Error references (any occurrence of each bug).'),
    resolution: z
      .string()
      .trim()
      .min(3)
      .max(2_000)
      .describe('What fixed them, e.g. "Fixed in a1b2c3d (PR #42)".'),
  }),
  async run({ input, actor, tx, log }) {
    const found = await findByRefs(tx, input.refs);
    const known = new Set(found.flatMap((f) => [f.ref.toUpperCase(), f.digest]));
    const notFound = input.refs.filter((r) => !known.has(r.toUpperCase()) && !known.has(r));
    if (found.length === 0) {
      throw new ActionError('not_found', `No error report for ${input.refs.join(', ')}.`);
    }
    const fingerprints = [...new Set(found.map((f) => f.fingerprint))];
    const resolved = await tx
      .update(errorEvents)
      .set({ resolvedAt: new Date(), resolvedBy: actor.contactId, resolution: input.resolution })
      .where(and(inArray(errorEvents.fingerprint, fingerprints), isNull(errorEvents.resolvedAt)))
      .returning({ id: errorEvents.id });
    log({
      subjectType: 'error',
      subjectId: found[0]!.id,
      summary: `Marked ${fingerprints.length} bug${fingerprints.length === 1 ? '' : 's'} fixed (${resolved.length} occurrence${resolved.length === 1 ? '' : 's'}): ${input.resolution}`,
    });
    return { resolved: resolved.length, groups: fingerprints.length, notFound };
  },
});

/** The last `n` calendar days (YYYY-MM-DD) in `zone`, oldest first. */
function lastDaysIn(zone: string, n: number, now = new Date()): string[] {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const today = fmt.format(now); // YYYY-MM-DD
  const [y, m, d] = today.split('-').map(Number) as [number, number, number];
  return Array.from({ length: n }, (_, i) => {
    // Plain calendar arithmetic on the day number (no clock, so no daylight-saving surprises).
    const day = new Date(Date.UTC(y, m - 1, d - (n - 1 - i)));
    return day.toISOString().slice(0, 10);
  });
}

export const errorOccurrences = defineAction({
  name: 'errors.occurrences',
  title: 'Error occurrences per day',
  description:
    'How often one bug happened on each of the last N days (days with none are 0, oldest first, days counted in ' +
    'the app time zone): the data for a sparkline. Give the `ref` of any occurrence, or the `fingerprint` of ' +
    'the group from errors.list. Also returns the total in the window.',
  audience: 'errors.manage',
  mutates: false,
  returns: '{ fingerprint, days: [{ day, count }], total }',
  input: z
    .object({
      ref: REF.optional(),
      fingerprint: z.string().trim().min(4).optional().describe('From errors.list.'),
      days: z.number().int().min(1).max(90).default(14),
    })
    .refine((v) => Boolean(v.ref) !== Boolean(v.fingerprint), {
      message: 'Give either a ref or a fingerprint.',
    }),
  async run({ input, tx }) {
    let fingerprint = input.fingerprint;
    if (!fingerprint) {
      const [found] = await findByRefs(tx, [input.ref!]);
      if (!found) throw new ActionError('not_found', `No error report "${input.ref}".`);
      fingerprint = found.fingerprint;
    }
    const zone = appTimeZone();
    const days = lastDaysIn(zone, input.days);
    // Start of the first day in the app zone, as an instant (a day earlier is enough slack; the
    // grouping below decides which day each row belongs to).
    const since = new Date(Date.parse(`${days[0]}T00:00:00Z`) - 36 * 3_600_000);
    const day = sql<string>`to_char(${errorEvents.occurredAt} at time zone ${zone}, 'YYYY-MM-DD')`;
    const rows = await tx
      .select({ day, count: sql<number>`count(*)::int` })
      .from(errorEvents)
      .where(and(eq(errorEvents.fingerprint, fingerprint), gte(errorEvents.occurredAt, since)))
      .groupBy(sql`1`); // the day column (the same expression twice would bind the zone twice)
    const byDay = new Map(rows.map((r) => [r.day, r.count]));
    const series = days.map((d) => ({ day: d, count: byDay.get(d) ?? 0 }));
    return {
      fingerprint,
      days: series,
      total: series.reduce((sum, s) => sum + s.count, 0),
    };
  },
});
