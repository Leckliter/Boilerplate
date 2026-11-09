'use client';

import { confirm } from '@app/ui/components/alert-dialog';
import { Button, type ButtonProps } from '@app/ui/components/button';
import { TrashIcon } from '@app/ui/components/icons';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

import type { ActionName } from '@/lib/action-names';
import { useAction } from '@/lib/use-action';

import { useCloseDialog } from './form-dialog';

/**
 * A destructive action that asks first (`confirm()`, never window.confirm). Use `inDialog` at the foot
 * of an Edit dialog; `redirectTo` after deleting the record you are standing on.
 *
 *   <DeleteForm action="projects.delete" input={{ id }} title="Delete this project?" redirectTo="/admin/projects" />
 */
export function DeleteForm({
  action,
  input,
  title,
  description,
  confirmLabel,
  label,
  success,
  redirectTo,
  inDialog = false,
  variant = 'destructive',
  size,
  icon = <TrashIcon />,
}: {
  action: ActionName;
  input: unknown;
  title?: string;
  description?: ReactNode;
  confirmLabel?: string;
  /** The trigger button's label. */
  label?: string;
  success?: string;
  redirectTo?: string;
  inDialog?: boolean;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  icon?: ReactNode;
}) {
  const t = useTranslations('forms');
  const { run, pending } = useAction();
  const router = useRouter();
  const closeDialog = useCloseDialog();
  return (
    <div className={inDialog ? 'mt-2 border-t border-hairline pt-4' : undefined}>
      <Button
        type="button"
        variant={variant}
        size={size}
        icon={icon}
        loading={pending}
        onClick={async () => {
          if (
            !(await confirm({
              title: title ?? t('areYouSure'),
              description,
              confirmLabel: confirmLabel ?? t('delete'),
            }))
          )
            return;
          const res = await run(action, input, {
            success: success ?? t('deleted'),
            refresh: !redirectTo,
          });
          if (!res.ok) return;
          closeDialog?.();
          if (redirectTo) router.push(redirectTo);
        }}
      >
        {label ?? t('delete')}
      </Button>
    </div>
  );
}
