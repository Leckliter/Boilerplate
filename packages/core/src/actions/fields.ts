import { z } from 'zod';

/**
 * A point in time, sent as an ISO string (e.g. `2026-11-01T15:04:05.000Z` or `2026-11-01`)
 * and handed to the action as a Date. Use this instead of `z.coerce.date()`: a Date can't be
 * described in JSON Schema, and one such field breaks the MCP tool list for every AI client.
 */
export const instantField = z
  .union([z.iso.datetime({ offset: true }), z.iso.date()])
  .transform((v) => new Date(v));
