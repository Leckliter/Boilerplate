'use client';

import './globals.css';

import { ErrorScreen } from '@/components/error-screen';

/** The root layout itself crashed, so this page renders its own <html>. */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <body>
        <ErrorScreen error={error} retry={retry} via="global-error" />
      </body>
    </html>
  );
}
