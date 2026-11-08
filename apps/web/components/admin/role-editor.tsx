'use client';

import { Button } from '@app/ui/components/button';
import { NativeSelect } from '@app/ui/components/input';
import { Badge } from '@app/ui/components/badge';
import { focusRing } from '@app/ui/components/link';
import { cn } from '@app/ui/lib/utils';
import { XIcon } from '@app/ui/components/icons';
import { useState } from 'react';

import { useAction } from '@/lib/use-action';

type RoleOption = { role: string; description: string };

/** Grant/revoke staff roles. Only shown to people with `access.manage`. */
export function RoleEditor({
  contactId,
  roles,
  options,
  hasLogin,
}: {
  contactId: string;
  roles: string[];
  options: RoleOption[];
  hasLogin: boolean;
}) {
  const { run, pending } = useAction();
  const available = options.filter((o) => !roles.includes(o.role));
  const [role, setRole] = useState(available[0]?.role ?? '');
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-1.5">
        {roles.length === 0 && (
          <span className="text-sm text-muted-foreground">Customer access only</span>
        )}
        {roles.map((r) => (
          <Badge key={r} color="green" className="pr-1 capitalize">
            {r}
            <button
              type="button"
              aria-label={`Revoke ${r}`}
              disabled={pending}
              onClick={() =>
                run('access.revokeRole', { contactId, role: r }, { success: `Removed ${r}` })
              }
              className={cn('opacity-60 hover:opacity-100 focus-visible:opacity-100', focusRing)}
            >
              <XIcon />
            </button>
          </Badge>
        ))}
      </div>
      {available.length > 0 && (
        <div className="flex gap-2">
          <NativeSelect
            value={role}
            onChange={(e) => setRole(e.target.value)}
            aria-label="Role to grant"
            className="h-8 min-w-0 flex-1 sm:max-w-56"
          >
            {available.map((o) => (
              <option key={o.role} value={o.role}>
                {o.role} — {o.description}
              </option>
            ))}
          </NativeSelect>
          <Button
            size="sm"
            disabled={pending || !role}
            onClick={() =>
              run('access.grantRole', { contactId, role }, { success: `Granted ${role}` })
            }
          >
            Grant role
          </Button>
        </div>
      )}
      {!hasLogin && (
        <p className="text-xs text-muted-foreground">
          No login yet. Roles take effect when they create an account using this contact’s email.
        </p>
      )}
    </div>
  );
}
