import { callAction, listFlags, listSettings } from '@app/core';
import { ROLE_NAMES } from '@app/core/flags';
import { Card } from '@app/ui/components/card';
import { Empty } from '@app/ui/components/empty';
import { SlidersHorizontalIcon } from '@app/ui/components/icons';
import { PageHeader } from '@app/ui/components/page';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@app/ui/components/table';
import { getServerDates } from '@/lib/dates-server';

import { ActionError } from '@/components/action-error';
import { FilterLinks } from '@/components/admin/filter-links';
import { IntegrationsPanel } from '@/components/admin/integrations-panel';
import { SettingDialog } from '@/components/admin/setting-dialog';
import { BrandForm } from '@/components/admin/settings/brand-form';
import { FlagCard } from '@/components/admin/settings/flag-card';
import { NotificationDefaults } from '@/components/admin/settings/notification-defaults';
import { BRAND_COLOR_KEY, BRAND_NAME_KEY } from '@/lib/settings-keys';
import { SITE } from '@/lib/site';
import { requireViewer } from '@/lib/viewer';

export const metadata = { title: 'Settings' };

const TABS = [
  { value: 'general', label: 'General' },
  { value: 'flags', label: 'Feature flags' },
  { value: 'integrations', label: 'Integrations' },
  { value: 'notifications', label: 'Notifications' },
  { value: 'all', label: 'All settings' },
] as const;

/**
 * Settings, in tabs (the tab is in the URL, so each loads only its own data): the app's name and brand
 * colour, feature flags, integration status, notification defaults, and the raw key/value list
 * (`settings.*`; read them in actions with `getSetting`).
 */
export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const viewer = await requireViewer('settings.manage', '/admin/settings');
  const { tab: rawTab } = await searchParams;
  const tab = TABS.find((t) => t.value === rawTab)?.value ?? 'general';
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Settings"
        description="Plain configuration the business can change without a deploy. Never secrets."
        actions={tab === 'all' ? <SettingDialog /> : undefined}
      />
      <FilterLinks
        label="Settings sections"
        items={TABS.map((t) => ({
          href: t.value === 'general' ? '/admin/settings' : `/admin/settings?tab=${t.value}`,
          label: t.label,
          active: t.value === tab,
        }))}
      />
      {tab === 'general' && <General viewer={viewer} />}
      {tab === 'flags' && <Flags viewer={viewer} />}
      {tab === 'integrations' && <IntegrationsPanel viewer={viewer} />}
      {tab === 'notifications' && <NotificationDefaults viewer={viewer} />}
      {tab === 'all' && <AllSettings viewer={viewer} />}
    </div>
  );
}

type Viewer = Awaited<ReturnType<typeof requireViewer>>;

async function General({ viewer }: { viewer: Viewer }) {
  const result = await callAction(listSettings, {}, viewer.actor);
  if (!result.ok) return <ActionError error={result.error} what="the settings" />;
  const value = (key: string) => result.data.find((s) => s.key === key)?.value;
  const name = value(BRAND_NAME_KEY);
  const color = value(BRAND_COLOR_KEY);
  return (
    <BrandForm
      name={typeof name === 'string' ? name : SITE.name}
      color={typeof color === 'string' ? color : null}
      canEdit
    />
  );
}

async function Flags({ viewer }: { viewer: Viewer }) {
  const result = await callAction(listFlags, {}, viewer.actor);
  if (!result.ok) return <ActionError error={result.error} what="the feature flags" />;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {result.data.map((f) => (
        <FlagCard key={f.name} flag={f} roleOptions={[...ROLE_NAMES]} canEdit />
      ))}
    </div>
  );
}

async function AllSettings({ viewer }: { viewer: Viewer }) {
  const { formatDateTime } = await getServerDates();
  const result = await callAction(listSettings, {}, viewer.actor);
  return (
    <Card>
      {!result.ok ? (
        <div className="p-5">
          <ActionError error={result.error} what="the settings" />
        </div>
      ) : result.data.length === 0 ? (
        <Empty
          icon={<SlidersHorizontalIcon />}
          title="No settings yet"
          description="Add one, e.g. business.name."
          contents={<SettingDialog />}
        />
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
                <TableCell className="max-w-xs truncate font-mono text-xs">
                  {JSON.stringify(s.value)}
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {formatDateTime(s.updatedAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
