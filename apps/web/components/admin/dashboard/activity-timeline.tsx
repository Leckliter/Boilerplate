'use client';

import { Empty } from '@app/ui/components/empty';
import { PulseIcon } from '@app/ui/components/icons';
import { Timeline } from '@app/ui/components/timeline';
import Link from 'next/link';

type Item = { id: string; summary: string; who: string; at: string; ok: boolean };

/** The last few audit entries as a timeline; each title opens the entry. Client only because Timeline formats times in the person's zone. */
export function ActivityTimeline({ items }: { items: Item[] }) {
  if (items.length === 0) {
    return (
      <Empty
        size="sm"
        icon={<PulseIcon />}
        title="Nothing has happened yet"
        description="Changes, sign-ins and API calls show up here."
      />
    );
  }
  return (
    <Timeline
      aria-label="Recent activity"
      items={items.map((i) => ({
        id: i.id,
        title: (
          <Link href={`/admin/activity/${i.id}`} className="underline-offset-4 hover:underline">
            {i.summary}
          </Link>
        ),
        description: i.who,
        at: i.at,
        tone: i.ok ? 'neutral' : 'danger',
      }))}
    />
  );
}
