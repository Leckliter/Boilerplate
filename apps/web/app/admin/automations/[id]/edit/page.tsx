import { callAction } from '@app/core';
import { automationsReference, getAutomation, type DefinitionInput } from '@app/core/automations';
import { PageHeader } from '@app/ui/components/page';

import { ActionError } from '@/components/action-error';
import { AutomationBuilder } from '@/components/automations/builder';
import { requireViewer } from '@/lib/viewer';

export const metadata = { title: 'Edit automation' };

export default async function EditAutomationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireViewer('automations.manage', `/admin/automations/${id}/edit`);
  const [got, ref] = await Promise.all([
    callAction(getAutomation, { id }, viewer.actor),
    callAction(automationsReference, {}, viewer.actor),
  ]);
  if (!got.ok) return <ActionError error={got.error} what="the automation" />;
  if (!ref.ok) return <ActionError error={ref.error} what="the building blocks" />;
  const a = got.data.automation;
  const initial: DefinitionInput = {
    name: a.name,
    description: a.description,
    tags: a.tags,
    trigger: a.trigger,
    conditions: a.conditions,
    steps: a.steps,
    cancelOn: a.cancelOn,
    concurrencyKey: a.concurrencyKey,
  };
  return (
    <div className="mx-auto grid w-full max-w-3xl">
      <PageHeader
        title={`Edit ${a.name}`}
        description="Runs already going keep the steps they started with; new runs use the new version."
      />
      <AutomationBuilder
        id={id}
        initial={initial}
        events={ref.data.events.map((e) => ({ type: e.type, description: e.description }))}
        actions={ref.data.actions.map((x) => ({ name: x.name, title: x.title }))}
        permissions={ref.data.permissions.map((p) => p.name)}
      />
    </div>
  );
}
