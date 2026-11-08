'use client';

import { Button } from '@app/ui/components/button';
import { ErrorReference } from '@app/ui/components/copy-button';
import { WarningIcon } from '@app/ui/components/icons';
import { useEffect, useState, useSyncExternalStore } from 'react';

import en from '@/messages/en.json';
import es from '@/messages/es.json';
import { reportClientError } from '@/lib/report-client-error';

const noSubscribe = () => () => {};

/** The language cookie, read without next-intl (this screen can render when the root layout crashed). */
function useIsSpanish() {
  return useSyncExternalStore(
    noSubscribe,
    () => document.cookie.split(';').some((c) => c.trim() === 'locale=es'),
    () => false,
  );
}

/**
 * What people see when a page crashes: an apology, the error reference (to hand to an AI agent, see
 * docs/errors.md) and "Try again". Reports the error to /api/errors and shows the reference it gets back.
 */
export function ErrorScreen({
  error,
  retry,
  via = 'boundary',
  area = false,
}: {
  error: unknown;
  retry?: () => void;
  via?: 'boundary' | 'global-error';
  /** Inside an area's shell (admin/account): the copy says the rest of the app is fine. */
  area?: boolean;
}) {
  const [reference, setReference] = useState<string | null>(null);
  const spanish = useIsSpanish();
  const t = { ...en.errors, ...(spanish ? es.errors : {}) } as typeof en.errors;
  const tryAgain = spanish ? es.common.tryAgain : en.common.tryAgain;
  useEffect(() => {
    let live = true;
    void reportClientError(error, via).then((ref) => live && setReference(ref));
    return () => {
      live = false;
    };
  }, [error, via]);

  return (
    <div
      className={
        area
          ? 'mx-auto grid w-full max-w-lg gap-4 rounded-xl border border-border bg-card p-6 text-sm shadow-xs'
          : 'mx-auto grid max-w-md gap-4 px-4 py-16 text-sm'
      }
    >
      <WarningIcon className="size-6 text-destructive" />
      <h1 className="text-xl font-semibold">{t.title}</h1>
      <p className="text-muted-foreground">{area ? t.bodyArea : t.body}</p>
      {reference && <ErrorReference reference={reference} />}
      {retry && (
        <div>
          <Button variant="primary" onClick={() => retry()}>
            {tryAgain}
          </Button>
        </div>
      )}
    </div>
  );
}
