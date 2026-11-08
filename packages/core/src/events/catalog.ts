import { z } from 'zod';

import { type EventType, event, id } from './define';

export type { EventType } from './define';

/**
 * THE list of business events — "this happened". Automations are triggered by them, wait for them
 * and are cancelled by them (docs/events.md).
 *
 * Add an event: define it here, add it to EVENT_TYPES, then call
 * `emit(tx, 'area.happened', data)` INSIDE the action (or webhook/cron transaction) where it
 * happens. Run `pnpm actions:docs` (the list is in docs/events.generated.md).
 *
 * Event names are permanent once shipped (saved automations refer to them), and data fields may
 * be added but never removed or renamed.
 *
 * Keep data small: ids plus what an automation needs to decide and to write a message (names,
 * numbers, amounts in cents). Automations fetch anything else with an action step (`contacts.get`).
 */

const EXAMPLE_ID = '00000000-0000-4000-8000-000000000001';

// ---------------------------------------------------------------- contacts

const contactCreated = event<'contact.created'>()({
  type: 'contact.created',
  description:
    'A contact was added by staff, the API, an AI or an automation (contacts.create). ' +
    'People who sign up themselves get a contact too, but through sign-in (user.signed_in), not this event.',
  subject: { type: 'contact', id: (d) => d.contactId },
  data: z.object({
    contactId: id,
    displayName: z.string(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    tags: z.array(z.string()),
  }),
  example: {
    contactId: EXAMPLE_ID,
    displayName: 'Pat Example',
    email: 'pat@example.com',
    phone: '+18165550100',
    tags: ['lead'],
  },
});

const contactUpdated = event<'contact.updated'>()({
  type: 'contact.updated',
  description:
    'A contact’s name, company, email, phone or notes changed (contacts.update). `fields` lists what changed.',
  subject: { type: 'contact', id: (d) => d.contactId },
  data: z.object({
    contactId: id,
    displayName: z.string(),
    fields: z.array(z.string()).describe('Names of the fields that changed, e.g. ["email"]'),
  }),
  example: { contactId: EXAMPLE_ID, displayName: 'Pat Example', fields: ['phone'] },
});

const contactTagged = event<'contact.tagged'>()({
  type: 'contact.tagged',
  description: 'Tags were added to a contact (only the newly added ones are listed).',
  subject: { type: 'contact', id: (d) => d.contactId },
  data: z.object({ contactId: id, displayName: z.string(), tags: z.array(z.string()) }),
  example: { contactId: EXAMPLE_ID, displayName: 'Pat Example', tags: ['customer'] },
});

const contactArchived = event<'contact.archived'>()({
  type: 'contact.archived',
  description:
    'A contact was archived: their login and API keys stopped working (contacts.archive).',
  subject: { type: 'contact', id: (d) => d.contactId },
  data: z.object({ contactId: id, displayName: z.string() }),
  example: { contactId: EXAMPLE_ID, displayName: 'Pat Example' },
});

// ---------------------------------------------------------------- access

const roleGranted = event<'role.granted'>()({
  type: 'role.granted',
  description: 'A staff role was given to a contact (access.grantRole).',
  subject: { type: 'contact', id: (d) => d.contactId },
  data: z.object({
    contactId: id,
    displayName: z.string(),
    role: z.string().describe('owner, admin, manager or staff'),
  }),
  example: { contactId: EXAMPLE_ID, displayName: 'Pat Example', role: 'manager' },
});

const roleRevoked = event<'role.revoked'>()({
  type: 'role.revoked',
  description: 'A staff role was taken away from a contact (access.revokeRole).',
  subject: { type: 'contact', id: (d) => d.contactId },
  data: z.object({ contactId: id, displayName: z.string(), role: z.string() }),
  example: { contactId: EXAMPLE_ID, displayName: 'Pat Example', role: 'manager' },
});

const apiKeyCreated = event<'api_key.created'>()({
  type: 'api_key.created',
  description:
    'An API key (REST / MCP) was created for a contact. Worth watching: keys act as their owner.',
  subject: { type: 'contact', id: (d) => d.contactId },
  data: z.object({
    contactId: id,
    apiKeyId: id,
    name: z.string(),
    restricted: z.boolean().describe('true when the key is limited to a list of permissions'),
  }),
  example: { contactId: EXAMPLE_ID, apiKeyId: EXAMPLE_ID, name: 'Zapier', restricted: true },
});

const userSignedIn = event<'user.signed_in'>()({
  type: 'user.signed_in',
  description:
    'Someone signed in. `first` is true the first time this contact ever signs in (a good moment for a welcome).',
  subject: { type: 'contact', id: (d) => d.contactId },
  data: z.object({ contactId: id, displayName: z.string(), first: z.boolean() }),
  example: { contactId: EXAMPLE_ID, displayName: 'Pat Example', first: true },
});

// ---------------------------------------------------------------- errors

const errorNew = event<'error.new'>()({
  type: 'error.new',
  description:
    'A new bug was reported: the first occurrence of an error fingerprint (or the first since it was marked fixed).',
  data: z.object({
    ref: z.string().describe('The error reference, e.g. E-7K3QX9MD (errors.get)'),
    code: z.string(),
    message: z.string(),
    where: z.string(),
    environment: z.string(),
  }),
  example: {
    ref: 'E-7K3QX9MD',
    code: 'db.missing_table',
    message: 'relation "app.things" does not exist',
    where: 'things.list',
    environment: 'production',
  },
});

const errorSpike = event<'error.spike'>()({
  type: 'error.spike',
  description:
    'An open bug is happening a lot: 10 times in 15 minutes (at most one event per bug per hour).',
  data: z.object({
    ref: z.string(),
    code: z.string(),
    message: z.string(),
    where: z.string(),
    environment: z.string(),
    count: z.number().int(),
    minutes: z.number().int(),
  }),
  example: {
    ref: 'E-7K3QX9MD',
    code: 'db.missing_table',
    message: 'relation "app.things" does not exist',
    where: 'things.list',
    environment: 'production',
    count: 12,
    minutes: 15,
  },
});

// ---------------------------------------------------------------- automations

const automationFailed = event<'automation.failed'>()({
  type: 'automation.failed',
  description:
    'An automation run stopped with an error. Automations never start from their own failure, ' +
    'so use this on a different automation (e.g. to tell a channel).',
  subject: { type: 'automation', id: (d) => d.automationId },
  data: z.object({
    automationId: id,
    automationName: z.string(),
    runId: id,
    error: z.string(),
  }),
  example: {
    automationId: EXAMPLE_ID,
    automationName: 'Welcome new leads',
    runId: EXAMPLE_ID,
    error: 'contacts.get: No such contact.',
  },
});

export const EVENT_TYPES = [
  contactCreated,
  contactUpdated,
  contactTagged,
  contactArchived,
  roleGranted,
  roleRevoked,
  apiKeyCreated,
  userSignedIn,
  errorNew,
  errorSpike,
  automationFailed,
] as const;

/** Event names and the data each one carries — `emit` is checked against this. */
export type EventDataMap = {
  [E in (typeof EVENT_TYPES)[number] as E['type']]: z.input<E['data']>;
};
export type EventName = keyof EventDataMap;

const byType = new Map<string, EventType>(
  EVENT_TYPES.map((e) => [e.type, e as unknown as EventType]),
);

export function getEventType(type: string): EventType | undefined {
  return byType.get(type);
}

export function listEventTypes(): readonly EventType[] {
  return EVENT_TYPES as unknown as readonly EventType[];
}
