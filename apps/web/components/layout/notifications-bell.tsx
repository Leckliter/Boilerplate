'use client';

import { BellIcon } from '@app/ui/components/icons';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

/**
 * The notifications bell slot in the header. The notifications module (app/account/notifications,
 * app/admin/notifications) replaces this with its inbox + unread count; until then it links to the
 * person's notification preferences. Delete it from the shell if you remove the module.
 */
export function NotificationsBell() {
  const t = useTranslations('shell');
  return (
    <Link
      href="/account/notifications"
      aria-label={t('notifications')}
      title={t('notifications')}
      className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors outline-none hover:bg-tint hover:text-foreground focus-visible:ring-[1.5px] focus-visible:ring-ring"
    >
      <BellIcon className="size-5" />
    </Link>
  );
}
