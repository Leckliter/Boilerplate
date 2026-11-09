'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@app/ui/components/dialog';
import { KeyIcon, PaletteIcon, SparkleIcon, UserPlusIcon } from '@app/ui/components/icons';
import { Wizard } from '@app/ui/components/wizard';
import Link from 'next/link';
import { useState } from 'react';

import { ONBOARDING_SETTING } from '@/lib/settings-keys';
import { useAction } from '@/lib/use-action';

const TIPS = [
  {
    icon: PaletteIcon,
    title: 'Brand',
    heading: 'Make it yours',
    text: 'Name the app and pick a brand colour under Settings. Everything follows one colour ramp.',
    href: '/admin/settings',
    cta: 'Open settings',
  },
  {
    icon: UserPlusIcon,
    title: 'Team',
    heading: 'Bring your team',
    text: 'Add a person, then give them a role. Tags describe people; roles decide what they can open.',
    href: '/admin/users/new',
    cta: 'Add a user',
  },
  {
    icon: KeyIcon,
    title: 'Services',
    heading: 'Connect services',
    text: 'Email, file storage and push need their keys. Integrations shows exactly which variables are missing.',
    href: '/admin/settings/integrations',
    cta: 'See integrations',
  },
];

/**
 * A one-time welcome for the owner, shown over the dashboard until it is finished or skipped; then
 * `onboarding.done` is saved as a setting (`settings.set`), so it never shows again, on any device.
 * Closing it any way counts as seen.
 */
export function OnboardingWizard({ show, appName }: { show: boolean; appName: string }) {
  const [open, setOpen] = useState(show);
  const { run, pending } = useAction();
  if (!show) return null;

  async function finish() {
    const res = await run(
      'settings.set',
      { key: ONBOARDING_SETTING, value: true },
      { refresh: false },
    );
    if (res.ok) setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !pending) void finish();
      }}
    >
      <DialogContent size="xl" showClose>
        <DialogHeader>
          <DialogTitle>Welcome to {appName}</DialogTitle>
          <DialogDescription>
            Three quick things to set up. You can skip any of them.
          </DialogDescription>
        </DialogHeader>
        <Wizard
          busy={pending}
          finishLabel="Start exploring"
          onFinish={finish}
          steps={[
            {
              id: 'welcome',
              label: 'Welcome',
              description: 'You are the owner, so you can see and change everything.',
              content: (
                <div className="flex items-start gap-3 rounded-lg bg-tint p-4 text-sm">
                  <SparkleIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
                  <p>
                    This is your admin. Every change is logged, every error gets a reference you can
                    hand to an AI, and everything you can do here the REST API and AI assistants can
                    do too, with the same rules.
                  </p>
                </div>
              ),
            },
            ...TIPS.map((t) => ({
              id: t.title,
              label: t.title,
              description: t.heading,
              content: (
                <div className="grid gap-3 text-sm">
                  <p className="flex items-start gap-3">
                    <t.icon aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
                    <span>{t.text}</span>
                  </p>
                  <Link
                    href={t.href}
                    onClick={() => void finish()}
                    className="w-fit font-medium text-primary underline underline-offset-4"
                  >
                    {t.cta}
                  </Link>
                </div>
              ),
            })),
          ]}
        />
      </DialogContent>
    </Dialog>
  );
}
