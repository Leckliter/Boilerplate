import { callAction } from '@app/core';
import { automationsReference } from '@app/core/automations';
import { PageHeader } from '@app/ui/components/page';

import { ActionError } from '@/components/action-error';
import { AutomationBuilder } from '@/components/automations/builder';
import { requireViewer } from '@/lib/viewer';

export const metadata = { title: 'New automation' };

export default async function NewAutomationPage() {
  const viewer = await requireViewer('automations.manage', '/admin/automations/new');
  const ref = await callAction(automationsReference, {}, viewer.actor);
  if (!ref.ok) return <ActionError error={ref.error} what="the building blocks" />;
  return (
    <div className="mx-auto grid w-full max-w-3xl">
      <PageHeader
        title="New automation"
        description="It starts off. Test it with “Run now”, then turn it on."
      />
      <AutomationBuilder
        events={ref.data.events.map((e) => ({ type: e.type, description: e.description }))}
        actions={ref.data.actions.map((a) => ({ name: a.name, title: a.title }))}
        permissions={ref.data.permissions.map((p) => p.name)}
      />
    </div>
  );
}
