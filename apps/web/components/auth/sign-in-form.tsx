'use client';

import { Button } from '@app/ui/components/button';
import { Input } from '@app/ui/components/input';
import { Field } from '@app/ui/components/label';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

import { FormError } from '@/components/forms/field-error';
import { requestCode, type SignInState, verifyCode } from '@/lib/auth/actions';

/** Email → emailed code. Both steps are server actions (lib/auth/actions.ts) over the AuthAdapter. */
export function SignInForm({ next }: { next: string }) {
  const t = useTranslations('auth');
  const [request, sendCode, sending] = useActionState<SignInState, FormData>(requestCode, {
    step: 'email',
  });
  const [verify, check, checking] = useActionState<SignInState, FormData>(verifyCode, {
    step: 'email',
  });

  // The code step is shown once a code was requested (and stays on a wrong code).
  const email =
    verify.step === 'code' ? verify.email : request.step === 'code' ? request.email : null;

  if (email) {
    const error = verify.step === 'code' ? verify.error : undefined;
    return (
      <div className="grid gap-5">
        <div className="grid gap-1.5">
          <h1 className="text-xl font-semibold tracking-tight">{t('codeTitle')}</h1>
          <p className="text-sm text-muted-foreground">{t('codeIntro', { email })}</p>
        </div>
        <form action={check} className="grid gap-4">
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="next" value={next} />
          <Field label={t('code')} error={error}>
            <Input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              maxLength={10}
              autoFocus
              required
              className="text-center font-mono text-lg tracking-[0.3em]"
            />
          </Field>
          <Button type="submit" variant="primary" loading={checking}>
            {t('verify')}
          </Button>
        </form>
        <form
          action={sendCode}
          className="flex flex-wrap items-center justify-between gap-2 text-sm"
        >
          <input type="hidden" name="email" value={email} />
          <Button type="submit" variant="ghost" size="sm" loading={sending}>
            {t('resend')}
          </Button>
          <a
            href={`/login?next=${encodeURIComponent(next)}`}
            className="text-muted-foreground underline underline-offset-4"
          >
            {t('differentEmail')}
          </a>
        </form>
        {request.step === 'code' && request.notice && !error && (
          <p role="status" className="text-sm text-success">
            {t('codeSent')}
          </p>
        )}
        {request.step === 'email' && request.error && <FormError message={request.error} />}
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-1.5">
        <h1 className="text-xl font-semibold tracking-tight">{t('signInTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('signInIntro')}</p>
      </div>
      <form action={sendCode} className="grid gap-4">
        <Field label={t('email')} error={request.step === 'email' ? request.error : undefined}>
          <Input
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            autoFocus
          />
        </Field>
        <Button type="submit" variant="primary" loading={sending}>
          {t('sendCode')}
        </Button>
      </form>
    </div>
  );
}
