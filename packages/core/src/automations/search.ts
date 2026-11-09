import { automations, ilike, or } from '@app/db';

import type { SearchContext, SearchResult } from '../actions/search/providers';

/** Automations, for people who may manage them. */
export async function searchAutomations({
  tx,
  can,
  per,
  like,
}: SearchContext): Promise<SearchResult[]> {
  if (!can('automations.manage')) return [];
  const rows = await tx
    .select({ id: automations.id, name: automations.name, enabled: automations.enabled })
    .from(automations)
    .where(or(ilike(automations.name, like), ilike(automations.description, like)))
    .limit(per);
  return rows.map((a) => ({
    type: 'automation' as const,
    id: a.id,
    title: a.name,
    subtitle: a.enabled ? 'Automation · on' : 'Automation · off',
    href: `/admin/automations/${a.id}`,
  }));
}
