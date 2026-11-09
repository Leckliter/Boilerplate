'use client';

import { MagnifyingGlassIcon } from '@app/ui/components/icons';
import { LinkButton } from '@app/ui/components/link-button';
import { useSyncExternalStore } from 'react';

import en from '@/messages/en.json';
import es from '@/messages/es.json';

const noSubscribe = () => () => {};

/**
 * "Page not found". A CLIENT component on purpose: the root not-found is part of every page's render tree, so
 * reading the language cookie on the server there (next-intl's getTranslations) would make every public
 * page dynamic. The cookie is read in the browser instead (the same way ErrorScreen does).
 */
export function NotFoundScreen() {
  const spanish = useSyncExternalStore(
    noSubscribe,
    () => document.cookie.split(';').some((c) => c.trim() === 'locale=es'),
    () => false,
  );
  const t = { ...en.errors, ...(spanish ? es.errors : {}) };
  return (
    <main
      id="main-content"
      className="mx-auto grid max-w-md justify-items-start gap-4 px-4 py-24 text-sm"
    >
      <MagnifyingGlassIcon className="size-6 text-muted-foreground" />
      <h1 className="text-xl font-semibold">{t.notFoundTitle}</h1>
      <p className="text-muted-foreground">{t.notFoundBody}</p>
      <LinkButton href="/" variant="primary">
        {t.home}
      </LinkButton>
    </main>
  );
}
