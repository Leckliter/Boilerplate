import type { AppRole } from '@app/db';

import { type Audience, type Permission, permissionsForRoles } from './permissions';

export type Channel = 'web' | 'api' | 'mcp' | 'system' | 'cli' | 'automation';

/** Where a request came from — copied onto activity-log rows and error reports. */
export type RequestInfo = {
  /** Ties together everything one request did (Vercel's `x-vercel-id` when deployed). */
  id: string;
  ip?: string | null;
  userAgent?: string | null;
  /** The page or endpoint, e.g. `/admin/contacts/123` or `/api/mcp`. */
  path?: string | null;
  /** Cloudflare Turnstile token from a public form, for actions with `humanCheck` (never logged). */
  humanToken?: string | null;
  /** `Idempotency-Key` sent by an API/AI client, so a retried change isn't done twice (idempotency.ts). */
  idempotencyKey?: string | null;
};

/**
 * WHO is doing something. Every action runs with an actor; the actor decides
 * what's allowed. Build one with the helpers below — never by hand.
 */
export type Actor = {
  kind: 'user' | 'api_key' | 'system' | 'guest';
  /** The contact acting (null for guests and the system). */
  contactId: string | null;
  roles: readonly AppRole[];
  permissions: ReadonlySet<Permission>;
  channel: Channel;
  apiKeyId?: string;
  /** An API key limited to a list of permissions. Such keys may not run `authenticated` changes either. */
  restricted?: boolean;
  /** The web/API request this actor is acting in (absent for scripts and tests). */
  request?: RequestInfo;
  /**
   * Set when an automation step is acting (docs/automations.md). Events emitted by the
   * action are marked as caused by this run, so automations can't trigger themselves
   * in a loop.
   */
  automation?: { automationId: string; runId: string; depth: number };
};

/** The same actor, tagged with the request it is acting in. */
export function withRequest(actor: Actor, request: RequestInfo): Actor {
  return { ...actor, request };
}

export function userActor(input: {
  contactId: string;
  roles: readonly AppRole[];
  channel?: Channel;
}): Actor {
  return {
    kind: 'user',
    contactId: input.contactId,
    roles: input.roles,
    permissions: permissionsForRoles(input.roles),
    channel: input.channel ?? 'web',
  };
}

/** An API key acts as its owner, narrowed to the key's permission list if it has one. */
export function apiKeyActor(input: {
  contactId: string;
  roles: readonly AppRole[];
  apiKeyId: string;
  keyPermissions: readonly string[] | null;
  channel: 'api' | 'mcp';
}): Actor {
  const owner = permissionsForRoles(input.roles);
  const permissions = input.keyPermissions
    ? new Set([...owner].filter((p) => input.keyPermissions!.includes(p)))
    : owner;
  return {
    kind: 'api_key',
    contactId: input.contactId,
    roles: input.roles,
    permissions,
    channel: input.channel,
    apiKeyId: input.apiKeyId,
    restricted: input.keyPermissions !== null,
  };
}

export function guestActor(channel: Channel = 'web'): Actor {
  return { kind: 'guest', contactId: null, roles: [], permissions: new Set(), channel };
}

/**
 * An automation step: the system (every permission — the rule was checked against its
 * editor's permissions when saved), on the `automation` channel, tagged with the run.
 * `idempotencyKey` makes a retried step return the first result instead of acting twice.
 */
export function automationActor(input: {
  automationId: string;
  runId: string;
  depth: number;
  idempotencyKey: string;
}): Actor {
  return {
    ...systemActor('automation'),
    request: {
      id: `automation-run:${input.runId}`,
      path: `automation:${input.automationId}`,
      idempotencyKey: input.idempotencyKey,
    },
    automation: { automationId: input.automationId, runId: input.runId, depth: input.depth },
  };
}

/** For crons, webhooks and scripts. Has every permission. */
export function systemActor(channel: Channel = 'system'): Actor {
  return {
    kind: 'system',
    contactId: null,
    roles: ['owner'],
    permissions: permissionsForRoles(['owner']),
    channel,
  };
}

export function hasPermission(actor: Actor, audience: Audience): boolean {
  if (audience === 'public') return true;
  if (audience === 'system') return actor.kind === 'system';
  if (audience === 'authenticated') return actor.kind === 'system' || actor.contactId !== null;
  return actor.permissions.has(audience);
}
