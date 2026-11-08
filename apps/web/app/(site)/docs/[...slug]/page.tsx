import { findDoc } from '@app/core/docs';
import { Badge } from '@app/ui/components/badge';
import { PageHeader } from '@app/ui/components/page';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { DocBody } from '@/components/docs/markdown';
import { getActor } from '@/lib/viewer';

type Props = { params: Promise<{ slug: string[] }> };

/** One doc. An internal doc is a 404 for anyone without `docs.internal` (the same answer as "no such doc"). */
async function load(params: Props['params']) {
  const { slug } = await params;
  return findDoc(await getActor(), slug.join('/'));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const doc = await load(params);
  return doc ? { title: doc.title, description: doc.summary } : {};
}

export default async function DocPage({ params }: Props) {
  const doc = await load(params);
  if (!doc) notFound();
  return (
    <article className="max-w-3xl">
      <PageHeader
        title={doc.title}
        description={
          <>
            {doc.summary} {doc.audience === 'internal' && <Badge color="amber">Staff only</Badge>}
          </>
        }
      />
      <DocBody blocks={doc.blocks} />
    </article>
  );
}
