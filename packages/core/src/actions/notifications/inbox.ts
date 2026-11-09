// ---------------------------------------------------------------- inbox
/** The in-app inbox: list, count, mark read, dismiss, open. */

import {
  and,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  lt,
  notifications,
  sql,
  type Tx,
} from '@app/db';
import { z } from 'zod';

import { NOTIFICATION_TYPES } from '../../notifications/registry';
import { ActionError, defineAction } from '../define';
import { instantField } from '../fields';
import { me } from './shared';

/** Types that skip quiet hours show under "needs attention". */
const URGENT_TYPES: string[] = NOTIFICATION_TYPES.filter(
  (t) => 'urgent' in t && t.urgent && t.key !== 'system.test',
).map((t) => t.key);

/** The inbox's rows: the person's own, not dismissed. */
const inboxRows = (contactId: string) =>
  and(eq(notifications.contactId, contactId), isNull(notifications.archivedAt));

export const listNotifications = defineAction({
  name: 'notifications.list',
  title: 'My notifications',
  description:
    'The signed-in person’s notification inbox, newest first, with the unread count and how many urgent ' +
    'ones are unread. `view`: all, unread, or attention (urgent types, e.g. error spikes). Dismissed ones are left ' +
    'out. Page with `before`.',
  audience: 'authenticated',
  mutates: false,
  returns:
    '{ items: [{ id, type, urgent, title, body, url, action, createdAt, readAt }], unread, attention }',
  input: z.object({
    view: z.enum(['all', 'unread', 'attention']).default('all'),
    before: instantField.optional(),
    limit: z.number().int().min(1).max(100).default(30),
  }),
  async run({ input, actor, tx }) {
    const contactId = me(actor);
    const rows = await tx
      .select()
      .from(notifications)
      .where(
        and(
          inboxRows(contactId),
          input.view === 'unread' ? isNull(notifications.readAt) : undefined,
          input.view === 'attention' ? inArray(notifications.type, URGENT_TYPES) : undefined,
          input.before ? lt(notifications.createdAt, input.before) : undefined,
        ),
      )
      .orderBy(desc(notifications.createdAt))
      .limit(input.limit);
    return {
      items: rows.map((n) => ({
        id: n.id,
        type: n.type,
        urgent: URGENT_TYPES.includes(n.type),
        title: n.content.title,
        body: n.content.body,
        url: n.content.url ?? null,
        action: n.content.action ?? null,
        createdAt: n.createdAt,
        readAt: n.readAt,
      })),
      ...(await inboxCounts(tx, contactId)),
    };
  },
});

/** Unread inbox items, and how many of them are urgent. */
export async function inboxCounts(tx: Tx, contactId: string) {
  const [row] = await tx
    .select({
      unread: count(),
      attention: sql<number>`count(*) filter (where ${inArray(notifications.type, URGENT_TYPES)})::int`,
    })
    .from(notifications)
    .where(and(inboxRows(contactId), isNull(notifications.readAt)));
  return { unread: row?.unread ?? 0, attention: row?.attention ?? 0 };
}

export const unreadCount = defineAction({
  name: 'notifications.unreadCount',
  title: 'Unread notifications',
  description:
    'How many unread notifications the signed-in person has in the inbox (dismissed ones are not counted).',
  audience: 'authenticated',
  mutates: false,
  returns: '{ unread: number, attention: number }',
  input: z.object({}),
  async run({ actor, tx }) {
    return inboxCounts(tx, me(actor));
  },
});

export const markRead = defineAction({
  name: 'notifications.markRead',
  title: 'Mark notifications read',
  description:
    'Mark some (ids) or all of the signed-in person’s notifications as read. read=false marks the given ids unread ' +
    'again (ids required).',
  audience: 'authenticated',
  mutates: true,
  // Reading your inbox isn't worth an audit entry.
  logOnlyWhenChanged: true,
  returns: '{ updated: number }',
  input: z
    .object({
      ids: z.array(z.uuid()).max(200).optional().describe('Omit to mark all read.'),
      read: z.boolean().default(true),
    })
    .refine((v) => v.read || v.ids, 'Say which notifications to mark unread.'),
  async run({ input, actor, tx }) {
    const rows = await tx
      .update(notifications)
      .set({ readAt: input.read ? new Date() : null })
      .where(
        and(
          eq(notifications.contactId, me(actor)),
          input.read ? isNull(notifications.readAt) : isNotNull(notifications.readAt),
          input.ids ? inArray(notifications.id, input.ids) : undefined,
        ),
      )
      .returning({ id: notifications.id });
    return { updated: rows.length };
  },
});

export const dismissNotifications = defineAction({
  name: 'notifications.dismiss',
  title: 'Clear notifications',
  description:
    'Clear some (ids) or all of the signed-in person’s inbox notifications: they leave the inbox for good (and count ' +
    'as read). Emails, texts and pushes already sent are unaffected.',
  audience: 'authenticated',
  mutates: true,
  logOnlyWhenChanged: true,
  returns: '{ dismissed: number }',
  input: z.object({
    ids: z.array(z.uuid()).max(200).optional().describe('Omit to clear everything in the inbox.'),
  }),
  async run({ input, actor, tx }) {
    const rows = await tx
      .update(notifications)
      .set({ archivedAt: new Date(), readAt: sql`coalesce(${notifications.readAt}, now())` })
      .where(
        and(inboxRows(me(actor)), input.ids ? inArray(notifications.id, input.ids) : undefined),
      )
      .returning({ id: notifications.id });
    return { dismissed: rows.length };
  },
});

export const openNotification = defineAction({
  name: 'notifications.open',
  title: 'Open a notification',
  description:
    'Mark one of the signed-in person’s notifications read and return where it links to.',
  audience: 'authenticated',
  mutates: true,
  logOnlyWhenChanged: true,
  returns: '{ url: string | null }',
  input: z.object({ id: z.uuid() }),
  async run({ input, actor, tx }) {
    const [n] = await tx
      .update(notifications)
      .set({ readAt: sql`coalesce(${notifications.readAt}, now())` })
      .where(and(eq(notifications.id, input.id), eq(notifications.contactId, me(actor))))
      .returning({ content: notifications.content });
    if (!n) throw new ActionError('not_found', 'No such notification.');
    return { url: n.content.url ?? null };
  },
});

export const recentNotifications = defineAction({
  name: 'notifications.recent',
  title: 'Recent notifications (the bell)',
  description:
    'The latest few items of the signed-in person’s inbox for the notification bell, newest first, each with the ' +
    '`href` to open, plus the unread count. Lighter than notifications.list (no paging, no views). ' +
    'Dismissed items are left out.',
  audience: 'authenticated',
  mutates: false,
  returns:
    '{ items: [{ id, type, title, body, href, action, urgent, createdAt, readAt }], unread, attention }',
  input: z.object({ limit: z.number().int().min(1).max(20).default(8) }),
  async run({ input, actor, tx }) {
    const contactId = me(actor);
    const rows = await tx
      .select()
      .from(notifications)
      .where(inboxRows(contactId))
      .orderBy(desc(notifications.createdAt))
      .limit(input.limit);
    return {
      items: rows.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.content.title,
        body: n.content.body,
        href: n.content.url ?? null,
        action: n.content.action ?? null,
        urgent: URGENT_TYPES.includes(n.type),
        createdAt: n.createdAt,
        readAt: n.readAt,
      })),
      ...(await inboxCounts(tx, contactId)),
    };
  },
});

export const markAllRead = defineAction({
  name: 'notifications.markAllRead',
  title: 'Mark all notifications read',
  description:
    'Mark every unread notification in the signed-in person’s inbox as read (the bell’s “Mark all read”).',
  audience: 'authenticated',
  mutates: true,
  logOnlyWhenChanged: true,
  returns: '{ updated: number, unread: 0 }',
  input: z.object({}),
  async run({ actor, tx }) {
    const rows = await tx
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(inboxRows(me(actor)), isNull(notifications.readAt)))
      .returning({ id: notifications.id });
    return { updated: rows.length, unread: 0 as const };
  },
});
