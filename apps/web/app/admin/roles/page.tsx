import { callAction, listRoles, listStaff } from '@app/core';
import { PERMISSIONS, type Permission } from '@app/core/access';
import { Avatar } from '@app/ui/components/avatar';
import { Badge } from '@app/ui/components/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@app/ui/components/card';
import { Callout } from '@app/ui/components/callout';
import { CheckIcon } from '@app/ui/components/icons';
import { PageHeader } from '@app/ui/components/page';
import { rowLink, rowLinkRow } from '@app/ui/components/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@app/ui/components/table';
import { cn } from '@app/ui/lib/utils';
import Link from 'next/link';

import { ActionError } from '@/components/action-error';
import { requireViewer } from '@/lib/viewer';

export const metadata = { title: 'Roles & permissions' };

/** Who can do what: the role × permission matrix (from the code, read-only) and who holds each role. */
export default async function RolesPage() {
  const viewer = await requireViewer('roles.manage', '/admin/roles');
  const [roles, staff] = await Promise.all([callAction(listRoles, {}, viewer.actor), callAction(listStaff, {}, viewer.actor)]);

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Roles & permissions"
        description="Roles are bundles of permissions. Tags describe people but never grant anything. To change what a role can do, edit packages/core/src/access/permissions.ts."
      />
      {!roles.ok ? (
        <ActionError error={roles.error} what="the roles" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Permission matrix</CardTitle>
            <CardDescription>A tick means the role has the permission.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Permission</TableHead>
                  {roles.data.map((r) => (
                    <TableHead key={r.role} className="text-center capitalize">
                      {r.role}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(Object.keys(PERMISSIONS) as Permission[]).map((p) => (
                  <TableRow key={p}>
                    <TableCell className="min-w-56">
                      <code className="text-xs font-medium">{p}</code>
                      <span className="block text-xs text-muted-foreground">{PERMISSIONS[p]}</span>
                    </TableCell>
                    {roles.data.map((r) => (
                      <TableCell key={r.role} className="text-center">
                        {r.permissions.includes(p) ? <CheckIcon className="mx-auto size-4 text-success" aria-label="Yes" /> : <span className="text-muted-foreground" aria-label="No">–</span>}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      {roles.ok && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {roles.data.map((r) => (
            <Card key={r.role} className="p-4">
              <p className="font-semibold capitalize">{r.role}</p>
              <p className="mt-1 text-sm text-muted-foreground">{r.description}</p>
            </Card>
          ))}
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle>People with app access</CardTitle>
          <CardDescription>Grant or revoke roles on a person’s page (Users).</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {!staff.ok ? (
            <div className="p-5">
              <ActionError error={staff.error} what="the staff" />
            </div>
          ) : staff.data.length === 0 ? (
            <div className="p-5">
              <Callout tone="warning">Nobody has a role yet. Set OWNER_EMAILS and sign in to become the first owner.</Callout>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Person</TableHead>
                  <TableHead>Roles</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.data.map((c) => (
                  <TableRow key={c.id} className={rowLinkRow}>
                    <TableCell>
                      <Link href={`/admin/users/${c.id}`} className={cn('flex items-center gap-3', rowLink)}>
                        <Avatar name={c.displayName} />
                        <span className="grid min-w-0">
                          <span className="truncate font-medium">{c.displayName}</span>
                          <span className="truncate text-xs text-muted-foreground">{c.email}</span>
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {c.roles.map((r) => (
                          <Badge key={r} color="green" className="capitalize">
                            {r}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
