import { activityLog, and, contacts, desc, eq, errorEvents, ilike, or, tags } from '@app/db';
import { z } from 'zod';

import { hasPermission } from '../../access';
import { defineAction } from '../define';
import {
  listSearchProviders,
  registerSearchProvider,
  type SearchContext,
  type SearchResult,
} from './providers';

export {
  registerSearchProvider,
  type SearchContext,
  type SearchProvider,
  type SearchResult,
} from './providers';

/** Contacts and tags: staff who may read users. */
async function searchContacts({
  tx,
  can,
  per,
  like,
  digits,
}: SearchContext): Promise<SearchResult[]> {
  const out: SearchResult[] = [];
  if (can('users.read')) {
    const rows = await tx
      .select({
        id: contacts.id,
        name: contacts.displayName,
        email: contacts.email,
        phone: contacts.phone,
        company: contacts.companyName,
      })
      .from(contacts)
      .where(
        and(
          eq(contacts.status, 'active'),
          or(
            ilike(contacts.displayName, like),
            ilike(contacts.email, like),
            ilike(contacts.companyName, like),
            digits.length >= 3 ? ilike(contacts.phone, `%${digits}%`) : undefined,
          ),
        ),
      )
      .orderBy(desc(contacts.updatedAt))
      .limit(per);
    out.push(
      ...rows.map((c) => ({
        type: 'contact' as const,
        id: c.id,
        title: c.name,
        subtitle: c.email ?? c.phone ?? c.company,
        href: `/admin/users/${c.id}`,
      })),
    );
    const tagRows = await tx
      .select()
      .from(tags)
      .where(or(ilike(tags.slug, like), ilike(tags.label, like)))
      .limit(per);
    out.push(
      ...tagRows.map((t) => ({
        type: 'tag' as const,
        id: t.slug,
        title: t.label,
        subtitle: t.description ?? `Tag · ${t.kind}`,
        href: `/admin/users?tag=${encodeURIComponent(t.slug)}`,
      })),
    );
  }

  return out;
}

/** Error reports by reference (`E-…`): staff who manage errors. */
async function searchErrors({ tx, can, per, q }: SearchContext): Promise<SearchResult[]> {
  const out: SearchResult[] = [];
  if (can('errors.manage') && /^e-/i.test(q)) {
    const rows = await tx
      .select({
        ref: errorEvents.ref,
        message: errorEvents.message,
        code: errorEvents.code,
        occurredAt: errorEvents.occurredAt,
      })
      .from(errorEvents)
      .where(ilike(errorEvents.ref, `${q.toUpperCase().replace(/[\\%_]/g, '\\$&')}%`))
      .orderBy(desc(errorEvents.occurredAt))
      .limit(per);
    out.push(
      ...rows.map((e) => ({
        type: 'error' as const,
        id: e.ref,
        title: `${e.ref}: ${e.message.slice(0, 80)}`,
        subtitle: e.code,
        href: `/admin/errors/${e.ref}`,
      })),
    );
  }

  return out;
}

/** Activity-log summaries: staff who may read the activity log. */
async function searchActivity({ tx, can, per, like, q }: SearchContext): Promise<SearchResult[]> {
  const out: SearchResult[] = [];
  if (can('activity.read') && q.length >= 3) {
    const rows = await tx
      .select({
        id: activityLog.id,
        action: activityLog.action,
        summary: activityLog.summary,
        occurredAt: activityLog.occurredAt,
      })
      .from(activityLog)
      .where(or(ilike(activityLog.summary, like), ilike(activityLog.action, like)))
      .orderBy(desc(activityLog.occurredAt))
      .limit(per);
    out.push(
      ...rows.map((a) => ({
        type: 'activity' as const,
        id: a.id,
        title: a.summary ?? a.action,
        subtitle: `${a.action} · ${a.occurredAt.toISOString().slice(0, 16).replace('T', ' ')}`,
        href: `/admin/activity/${a.id}`,
      })),
    );
  }

  return out;
}

// Core kinds. Optional modules add theirs in their register.ts (docs 20, automations 30, inquiries 40).
registerSearchProvider('contacts', searchContacts, { order: 10 });
registerSearchProvider('errors', searchErrors, { order: 50 });
registerSearchProvider('activity', searchActivity, { order: 60 });

export const search = defineAction({
  name: 'search.query',
  title: 'Search everything',
  description:
    'One search box for the ⌘K palette: contacts (name, email, phone, company), tags, error reports by reference ' +
    '(type `E-…`) and activity-log summaries, plus docs, automations and inquiries when those modules are on — only the kinds the caller may ' +
    'see (a customer gets docs only). Each hit is `{ type, id, title, subtitle, href }`; `href` is the page to open. ' +
    'Results are grouped by kind in a fixed order and cut at `limit`.',
  audience: 'authenticated',
  mutates: false,
  returns: '{ results: [{ type, id, title, subtitle, href }] }',
  input: z.object({
    q: z.string().trim().min(1).max(100),
    limit: z.number().int().min(1).max(50).default(20),
  }),
  async run({ input, actor, tx }) {
    const ctx: SearchContext = {
      tx,
      actor,
      q: input.q,
      per: Math.max(3, Math.ceil(input.limit / 3)),
      like: `%${input.q.replace(/[\\%_]/g, '\\$&')}%`,
      digits: input.q.replace(/\D/g, ''),
      can: (p) => hasPermission(actor, p),
    };
    const out: SearchResult[] = [];
    for (const provider of listSearchProviders()) out.push(...(await provider.run(ctx)));
    return { results: out.slice(0, input.limit) };
  },
});
