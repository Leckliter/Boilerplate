import { desc, ilike, inquiries, or } from '@app/db';

import type { SearchContext, SearchResult } from '../actions/search/providers';

/** Website inquiries, for people who manage them. */
export async function searchInquiries({
  tx,
  can,
  per,
  like,
}: SearchContext): Promise<SearchResult[]> {
  if (!can('inquiries.manage')) return [];
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
  return rows.map((i) => ({
    type: 'inquiry' as const,
    id: i.id,
    title: `Inquiry from ${i.name}`,
    subtitle: `${i.subject ?? 'No subject'} · ${i.status}`,
    href: `/admin/inquiries/${i.id}`,
  }));
}
