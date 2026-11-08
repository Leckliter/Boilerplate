import { callAction, listSettings } from '@app/core';
import { Card } from '@app/ui/components/card';
import { Empty } from '@app/ui/components/empty';
import { SlidersHorizontalIcon } from '@app/ui/components/icons';
import { PageHeader } from '@app/ui/components/page';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@app/ui/components/table';
import { formatDateTime } from '@app/ui/lib/dates';

import { ActionError } from '@/components/action-error';
import { SettingDialog } from '@/components/admin/setting-dialog';
import { requireViewer } from '@/lib/viewer';

export const metadata = { title: 'Settings' };

/** Business settings: dotted keys with JSON values (`settings.*`). Read them in actions with `getSetting`. */
export default async function SettingsPage() {
  const viewer = await requireViewer('settings.manage', '/admin/settings');
  const result = await callAction(listSettings, {}, viewer.actor);
  return (
    <div className="grid gap-6">
      <PageHeader title="Settings" description="Plain configuration the business can change without a deploy. Never secrets." actions={<SettingDialog />} />
      <Card>
        {!result.ok ? (
          <div className="p-5">
            <ActionError error={result.error} what="the settings" />
          </div>
        ) : result.data.length === 0 ? (
          <Empty icon={<SlidersHorizontalIcon />} title="No settings yet" description="Add one, e.g. business.name." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Value</TableHead>
                <TableHead className="hidden md:table-cell">Changed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.data.map((s) => (
                <TableRow key={s.key}>
                  <TableCell>
                    <code className="text-xs font-medium">{s.key}</code>
                  </TableCell>
                  <TableCell className="max-w-xs truncate font-mono text-xs">{JSON.stringify(s.value)}</TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{formatDateTime(s.updatedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
