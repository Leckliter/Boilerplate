import { Button } from '@app/ui/components/button';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

import { signOut } from '@/lib/auth/actions';
import { getViewer } from '@/lib/viewer';

export const metadata: Metadata = { title: 'Verify your email' };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ disabled?: string }>;
}) {
  const { disabled } = await searchParams;
  const viewer = await getViewer();
  const t = await getTranslations('auth');
  const tc = await getTranslations('common');
  return (
    <div className="grid gap-4">
      <h1 className="text-xl font-semibold tracking-tight">
        {disabled ? t('disabledTitle') : t('verifyTitle')}
      </h1>
      <p className="text-sm text-muted-foreground">{disabled ? t('disabledBody') : t('verifyBody')}</p>
      {viewer.status === 'verify_email' && (
        <p className="text-sm">
          Signed in as <strong>{viewer.email}</strong>
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <form action={signOut}>
          <Button type="submit">{tc('signOut')}</Button>
        </form>
        <Link href="/login" className="inline-flex h-9 items-center px-3 text-sm underline underline-offset-4">
          {tc('signIn')}
        </Link>
      </div>
    </div>
  );
}
