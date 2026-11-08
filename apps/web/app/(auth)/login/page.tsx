import { Callout } from '@app/ui/components/callout';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

import { SignInForm } from '@/components/auth/sign-in-form';
import { authConfigured } from '@/lib/auth';
import { devLoginEnabled } from '@/lib/auth/dev';
import { safeNext } from '@/lib/safe-next';
import { getViewer } from '@/lib/viewer';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next: rawNext, error } = await searchParams;
  const next = safeNext(rawNext);
  const viewer = await getViewer();
  if (viewer.status === 'signed_in') redirect(next);
  const t = await getTranslations('auth');
  return (
    <div className="grid gap-4">
      {error === 'link' && <Callout tone="danger">{t('linkFailed')}</Callout>}
      {!authConfigured() && <Callout tone="warning">{t('notConfigured')}</Callout>}
      {devLoginEnabled() && <Callout tone="info">{t('devNotice')}</Callout>}
      <SignInForm next={next} />
    </div>
  );
}
