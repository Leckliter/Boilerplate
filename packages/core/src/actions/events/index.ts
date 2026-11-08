import { and, desc, eq, events } from '@app/db';
import { z } from 'zod';

import { emit } from '../../events/emit';
import { defineAction } from '../define';

export const listEvents = defineAction({
  name: 'events.list',
  title: 'List business events',
  description:
    'The event log, newest first: what happened (contact.created, role.granted …), its data, what it was about, and ' +
    'whether automations have been handed it yet (dispatchedAt). Filter by type or subject.',
  audience: 'automations.manage',
  mutates: false,
  returns:
    '[{ id, type, data, subjectType, subjectId, depth, causeAutomationId, occurredAt, dispatchedAt }]',
  input: z.object({
    type: z.string().optional(),
    subjectType: z.string().optional(),
    subjectId: z.uuid().optional(),
    limit: z.number().int().min(1).max(200).default(50),
  }),
  async run({ input, tx }) {
    return tx
      .select({
        id: events.id,
        type: events.type,
        data: events.data,
        subjectType: events.subjectType,
        subjectId: events.subjectId,
        depth: events.depth,
        causeAutomationId: events.causeAutomationId,
        occurredAt: events.occurredAt,
        dispatchedAt: events.dispatchedAt,
      })
      .from(events)
      .where(
        and(
          input.type ? eq(events.type, input.type) : undefined,
          input.subjectType ? eq(events.subjectType, input.subjectType) : undefined,
          input.subjectId ? eq(events.subjectId, input.subjectId) : undefined,
        ),
      )
      .orderBy(desc(events.occurredAt))
      .limit(input.limit);
  },
});

export const recordSignIn = defineAction({
  name: 'events.recordSignIn',
  title: 'Record a sign-in as an event',
  description:
    'System only: called by the web app after someone signed in (and was linked to their contact), so automations ' +
    'can react (`user.signed_in`). `first` = their first ever sign-in. Not an AI tool; nothing to call by hand.',
  audience: 'system',
  mutates: true,
  // Sign-ins already have their own entries in the activity log (kind = auth).
  logOnlyWhenChanged: true,
  returns: '{ emitted: boolean }',
  input: z.object({ contactId: z.uuid(), displayName: z.string().max(300), first: z.boolean() }),
  async run({ input, tx }) {
    const id = await emit(tx, 'user.signed_in', input);
    return { emitted: id !== null };
  },
});
