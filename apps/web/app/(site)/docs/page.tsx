import { callAction } from '@app/core';
import { docTree, listDocs } from '@app/core/docs';
import { Card } from '@app/ui/components/card';
import { Empty } from '@app/ui/components/empty';
import { BookOpenIcon } from '@app/ui/components/icons';
import { PageHeader } from '@app/ui/components/page';
import Link from 'next/link';

import { ActionError } from '@/components/action-error';
import { getActor } from '@/lib/viewer';

export const metadata = { title: 'Docs' };

export default async function DocsIndex({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const q = ((await searchParams).q ?? '').trim().slice(0, 200);
  const actor = await getActor();

  if (q) {
    const res = await callAction(listDocs, { query: q }, actor);
    if (!res.ok) return <ActionError error={res.error} what="the docs" />;
    return (
      <>
        <PageHeader
          title={`Search: ${q}`}
          description={`${res.data.docs.length} result${res.data.docs.length === 1 ? '' : 's'}`}
        />
        {res.data.docs.length === 0 ? (
          <Card>
            <Empty
              icon={<BookOpenIcon />}
              title="Nothing found"
              description="Try fewer or different words."
            />
          </Card>
        ) : (
          <ul className="grid gap-3">
            {res.data.docs.map((d) => (
              <li key={d.slug} className="min-w-0">
                <Link href={`/docs/${d.slug}`} className="font-medium hover:underline">
                  {d.title}
                </Link>
                <p className="text-sm text-muted-foreground">{d.summary}</p>
              </li>
            ))}
          </ul>
        )}
      </>
    );
  }

  const tree = docTree(actor);
  return (
    <>
      <PageHeader title="Docs" description="How things work. Short pages, plain words." />
      {tree.length === 0 ? (
        <Card>
          <Empty
            icon={<BookOpenIcon />}
            title="No docs yet"
            description="Add Markdown files under apps/web/content/docs and run pnpm docs:build."
          />
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {tree.map((s) => (
            <Card key={s.id} className="grid gap-2 p-5">
              <h2 className="text-lg font-semibold">{s.title}</h2>
              <p className="text-sm text-muted-foreground">{s.description}</p>
              <ul className="grid gap-1 pt-2">
                {s.docs.map((d) => (
                  <li key={d.slug} className="min-w-0">
                    <Link href={`/docs/${d.slug}`} className="hover:underline">
                      {d.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
