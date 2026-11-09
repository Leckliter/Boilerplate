import {
  activityLog,
  and,
  automations,
  contacts,
  desc,
  eq,
  errorEvents,
  ilike,
  inquiries,
  or,
  tags,
} from '@app/db';
import { z } from 'zod';

import { hasPermission } from '../../access';
import { searchDocs } from '../../docs';
import { defineAction } from '../define';

export type SearchResult = {
  type: 'contact' | 'tag' | 'doc' | 'automation' | 'error' | 'activity' | 'inquiry';
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
};

export const search = defineAction({
  name: 'search.query',
  title: 'Search everything',
  description:
    'One search box for the ⌘K palette: contacts (name, email, phone, company), tags, docs, automations, ' +
    'inquiries, error reports by reference (type `E-…`) and activity-log summaries — only the kinds the caller may ' +
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
    const per = Math.max(3, Math.ceil(input.limit / 3));
    const like = `%${input.q.replace(/[\\%_]/g, '\\$&')}%`;
    const digits = input.q.replace(/\D/g, '');
    const out: SearchResult[] = [];
    const can = (p: Parameters<typeof hasPermission>[1]) => hasPermission(actor, p);

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

    // Docs: the same visibility rule as docs.list (internal ones only for staff).
    out.push(
      ...searchDocs(actor, input.q)
        .slice(0, per)
        .map((d) => ({
          type: 'doc' as const,
          id: d.slug,
          title: d.title,
          subtitle: d.summary || null,
          href: `/docs/${d.slug}`,
        })),
    );

    if (can('automations.manage')) {
      const rows = await tx
        .select({ id: automations.id, name: automations.name, enabled: automations.enabled })
        .from(automations)
        .where(or(ilike(automations.name, like), ilike(automations.description, like)))
        .limit(per);
      out.push(
        ...rows.map((a) => ({
          type: 'automation' as const,
          id: a.id,
          title: a.name,
          subtitle: a.enabled ? 'Automation · on' : 'Automation · off',
          href: `/admin/automations/${a.id}`,
        })),
      );
    }

    if (can('inquiries.manage')) {
      const rows = await tx
        .select({
          id: inquiries.id,
          name: inquiries.name,
          subject: inquiries.subject,
          status: inquiries.status,
        })
        .from(inquiries)
        .where(
          or(
            ilike(inquiries.name, like),
            ilike(inquiries.email, like),
            ilike(inquiries.subject, like),
            ilike(inquiries.message, like),
          ),
        )
        .orderBy(desc(inquiries.createdAt))
        .limit(per);
      out.push(
        ...rows.map((i) => ({
          type: 'inquiry' as const,
          id: i.id,
          title: `Inquiry from ${i.name}`,
          subtitle: `${i.subject ?? 'No subject'} · ${i.status}`,
          href: `/admin/inquiries/${i.id}`,
        })),
      );
    }

    if (can('errors.manage') && /^e-/i.test(input.q)) {
      const rows = await tx
        .select({
          ref: errorEvents.ref,
          message: errorEvents.message,
          code: errorEvents.code,
          occurredAt: errorEvents.occurredAt,
        })
        .from(errorEvents)
        .where(ilike(errorEvents.ref, `${input.q.toUpperCase().replace(/[\\%_]/g, '\\$&')}%`))
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

    if (can('activity.read') && input.q.length >= 3) {
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

    return { results: out.slice(0, input.limit) };
  },
});
