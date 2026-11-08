import { callAction, listIntegrations } from '@app/core';
import { Badge } from '@app/ui/components/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@app/ui/components/card';
import { PageHeader } from '@app/ui/components/page';

import { ActionError } from '@/components/action-error';
import { IntegrationSwitch } from '@/components/admin/integration-switch';
import { requireViewer } from '@/lib/viewer';

export const metadata = { title: 'Integrations' };

/**
 * Outside services: whether each is configured (from environment variables: only the NAMES still missing
 * are shown, never values) and its kill switch.
 */
export default async function IntegrationsPage() {
  const viewer = await requireViewer('settings.manage', '/admin/settings/integrations');
  const result = await callAction(listIntegrations, {}, viewer.actor);
  return (
    <div className="grid gap-6">
      <PageHeader title="Integrations" description="Set the variables in your host's environment (see .env.example). The switch turns a configured service off without removing its keys." />
      {!result.ok ? (
        <ActionError error={result.error} what="the integrations" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {result.data.map((i) => (
            <Card key={i.id}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  {i.label}
                  {i.configured ? <Badge color="green">Configured</Badge> : i.core ? <Badge color="red">Missing</Badge> : <Badge color="outline">Not set up</Badge>}
                  {i.core && <Badge color="outline">Required</Badge>}
                </CardTitle>
                <CardDescription>{i.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 text-sm text-muted-foreground">
                  {i.configured ? (
                    'All variables are set.'
                  ) : (
                    <>
                      Missing: {i.missing.map((m) => <code key={m} className="mr-1 text-xs">{m}</code>)}
                      {i.invalid.length > 0 && <span className="block">Invalid: {i.invalid.join(', ')}</span>}
                    </>
                  )}
                </div>
                {!i.core && <IntegrationSwitch id={i.id} label={i.label} enabled={i.enabled} />}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
