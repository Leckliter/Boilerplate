import { activityLog, contacts, eq, getDb, or, type Tx } from '@app/db';

import type { Actor, RequestInfo } from './access';
import { redact } from './redact';

export type ActivityRow = typeof activityLog.$inferInsert;

/** The who/where columns of an activity row, taken from the actor and its request. */
export function actorColumns(actor: Actor) {
  return {
    actorKind: actor.kind,
    actorContactId: actor.contactId,
    apiKeyId: actor.apiKeyId ?? null,
    channel: actor.channel,
    ...requestColumns(actor.request),
  };
}

function requestColumns(request: Partial<RequestInfo> | undefined) {
  return {
    requestId: request?.id ?? null,
    ip: request?.ip ?? null,
    userAgent: request?.userAgent?.slice(0, 500) ?? null,
  };
}

/**
 * Write one activity-log row. Pass `tx` to make it part of a transaction;
 * otherwise it's written on its own and a failure to log is reported to the
 * server log rather than thrown (logging must never break what it records).
 */
export async function recordActivity(row: ActivityRow, tx?: Tx): Promise<void> {
  const values = { ...row, input: row.input === undefined ? null : redact(row.input) };
  if (tx) {
    await tx.insert(activityLog).values(values);
    return;
  }
  // Logging must never break what it records: the server log is the fallback.
  await getDb()
    .insert(activityLog)
    .values(values)
    .catch((e) => console.error('[activity_log] could not record', row.action, e));
}

export type AuthEvent =
  | 'auth.signIn'
  | 'auth.signInFailed'
  | 'auth.signOut'
  | 'auth.signUp'
  | 'auth.emailConfirmed'
  | 'auth.codeRequested'
  | 'auth.linkFailed';

/**
 * Record a sign-in, sign-out, sign-up or sign-in-code event. Who it was about is
 * found from the login id or email; the event is recorded either way (a
 * failed sign-in for an unknown email is still worth seeing).
 */
export async function recordAuthEvent(event: {
  action: AuthEvent;
  ok: boolean;
  summary: string;
  authUserId?: string | null;
  email?: string | null;
  request?: Partial<RequestInfo>;
  /** Extra detail for the log, e.g. { method: 'google' } or the provider's error code. */
  detail?: Record<string, unknown>;
}): Promise<void> {
  const email = event.email?.trim().toLowerCase() || null;
  let contactId: string | null = null;
  try {
    if (event.authUserId || email) {
      const conditions = [
        event.authUserId ? eq(contacts.authUserId, event.authUserId) : undefined,
        email ? eq(contacts.email, email) : undefined,
      ].filter((c) => c !== undefined);
      const [c] = await getDb()
        .select({ id: contacts.id })
        .from(contacts)
        .where(or(...conditions))
        .limit(1);
      contactId = c?.id ?? null;
    }
  } catch (e) {
    // Logging must never break sign-in: the server log is the fallback.
    console.error('[activity_log] could not look up contact for auth event', e);
  }
  // A failed attempt is not proof of who it was: record the email, not the person.
  const actorIsContact = event.ok && contactId !== null;
  await recordActivity({
    kind: 'auth',
    action: event.action,
    actorKind: actorIsContact ? 'user' : 'guest',
    actorContactId: actorIsContact ? contactId : null,
    channel: 'web',
    subjectType: contactId ? 'contact' : null,
    subjectId: contactId,
    summary: event.summary,
    input: { email, ...event.detail },
    ok: event.ok,
    errorCode: event.ok ? null : 'auth_failed',
    ...requestColumns(event.request),
  });
}
