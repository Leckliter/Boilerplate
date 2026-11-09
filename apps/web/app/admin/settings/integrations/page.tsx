import { PageHeader } from '@app/ui/components/page';

import { IntegrationsPanel } from '@/components/admin/integrations-panel';
import { requireViewer } from '@/lib/viewer';

export const metadata = { title: 'Integrations' };

/** Outside services and their kill switches (the same panel is a tab on Settings). */
export default async function IntegrationsPage() {
  const viewer = await requireViewer('settings.manage', '/admin/settings/integrations');
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Integrations"
        description="Set the variables in your host's environment (see .env.example). The switch turns a configured service off without removing its keys."
      />
      <IntegrationsPanel viewer={viewer} />
    </div>
  );
}
