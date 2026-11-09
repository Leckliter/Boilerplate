'use client';

import type { DataTableLabels } from '@app/ui/components/data-table';
import type { NotificationListLabels } from '@app/ui/components/notification-list';
import type { StepsLabels } from '@app/ui/components/steps';
import type { ThemeToggleLabels } from '@app/ui/components/theme-toggle';
import type { WizardLabels } from '@app/ui/components/wizard';
import { useTranslations } from 'next-intl';

/**
 * Translated words for the `@app/ui` components that have English defaults. Each hook returns the
 * `labels` prop of one component (messages: `ui.*` in messages/*.json), so a screen writes
 * `<DataTable labels={useTableLabels()} … />` and the component speaks the person's language.
 */

export function useThemeToggleLabels(): ThemeToggleLabels {
  const t = useTranslations('ui.theme');
  return { legend: t('legend'), light: t('light'), dark: t('dark'), system: t('system') };
}

export function useStepsLabels(): StepsLabels {
  const t = useTranslations('ui.steps');
  return {
    progress: t('progress'),
    done: t('done'),
    next: t('next'),
    goBack: (label) => t('goBack', { label }),
  };
}

export function useWizardLabels(): WizardLabels {
  const t = useTranslations('ui.wizard');
  const steps = useStepsLabels();
  return {
    region: t('region'),
    back: t('back'),
    next: t('next'),
    finish: t('finish'),
    stepOf: (step, total) => t('stepOf', { step, total }),
    steps,
  };
}

export function useNotificationListLabels(): NotificationListLabels {
  const t = useTranslations('ui.notificationList');
  return {
    region: t('region'),
    unread: (count) => t('unread', { count }),
    noUnread: t('noUnread'),
    markAllRead: t('markAllRead'),
    markAsRead: t('markAsRead'),
    unreadPrefix: t('unreadPrefix'),
    empty: t('empty'),
  };
}

export function useTableLabels(): DataTableLabels {
  const t = useTranslations('ui.table');
  return {
    sortBy: t('sortBy'),
    defaultOrder: t('defaultOrder'),
    ascending: (column) => t('ascending', { column }),
    descending: (column) => t('descending', { column }),
    selectAll: (caption) => t('selectAll', { caption }),
    selectRow: (id) => t('selectRow', { id }),
    loading: t('loading'),
    empty: t('empty'),
  };
}
