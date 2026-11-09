import { callAction, listIntegrations } from '@app/core';
import { Badge } from '@app/ui/components/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@app/ui/components/card';
import { BookOpenIcon } from '@app/ui/components/icons';

import { ActionError } from '@/components/action-error';
import { IntegrationSwitch } from '@/components/admin/integration-switch';
import type { SignedInViewer } from '@/lib/viewer';

/** Where to read about setting each integration up: the repo doc and the section in it (docs/README.md has the index). */
const DOCS: Record<string, { file: string; section: string }> = {
  database: { file: 'docs/choosing-a-backend.md', section: 'Database' },
  auth: { file: 'docs/choosing-a-backend.md', section: 'Auth' },
  'site-url': { file: '.env.example', section: 'App' },
  storage: { file: 'docs/files.md', section: 'Storage' },
  email: { file: 'docs/notifications.md', section: 'What decides who gets what' },
  sms: { file: 'docs/notifications.md', section: 'SMS needs recorded consent' },
  push: { file: 'docs/notifications.md', section: 'Push (Web Push)' },
  cron: { file: 'docs/notifications.md', section: 'Cron' },
  'human-check': { file: 'docs/actions.md', section: 'Abuse protection' },
};

/**
 * Outside services: whether each is configured (from environment variables: only the NAMES still missing
 * are shown, never values), its kill switch, and where its setup is documented. Used by Settings →
 * Integrations and by /admin/settings/integrations.
 */
export async function IntegrationsPanel({ viewer }: { viewer: SignedInViewer }) {
  const result = await callAction(listIntegrations, {}, viewer.actor);
  if (!result.ok) return <ActionError error={result.error} what="the integrations" />;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {result.data.map((i) => {
        const doc = DOCS[i.id];
        return (
          <Card key={i.id}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                {i.label}
                {i.configured ? (
                  <Badge color="green">Configured</Badge>
                ) : i.core ? (
                  <Badge color="red">Missing</Badge>
                ) : (
                  <Badge color="outline">Not set up</Badge>
                )}
                {i.core && <Badge color="outline">Required</Badge>}
              </CardTitle>
              <CardDescription>{i.description}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 text-sm text-muted-foreground">
                  {i.configured ? (
                    'All variables are set.'
                  ) : (
                    <>
                      Missing:{' '}
                      {i.missing.map((m) => (
                        <code key={m} className="mr-1 text-xs">
                          {m}
                        </code>
                      ))}
                      {i.invalid.length > 0 && (
                        <span className="block">Invalid: {i.invalid.join(', ')}</span>
                      )}
                    </>
                  )}
                </div>
                {!i.core && <IntegrationSwitch id={i.id} label={i.label} enabled={i.enabled} />}
              </div>
              {doc && (
                <p className="flex items-start gap-2 text-xs text-muted-foreground">
                  <BookOpenIcon aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                  <span className="min-w-0">
                    Setup: <code className="[overflow-wrap:anywhere]">{doc.file}</code> →{' '}
                    {doc.section}
                  </span>
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
