'use client';

import { Badge } from '@app/ui/components/badge';
import { Button } from '@app/ui/components/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@app/ui/components/card';
import { CheckboxField } from '@app/ui/components/checkbox';
import { Slider } from '@app/ui/components/slider';
import { Switch } from '@app/ui/components/switch';
import { useState } from 'react';

import { useAction } from '@/lib/use-action';

export type FlagView = {
  name: string;
  description: string;
  configured: boolean;
  enabled: boolean;
  percent?: number;
  roles?: string[];
};

/** A sentence saying who the flag is on for right now (so the card reads without decoding the controls). */
function who(enabled: boolean, percent: number | null, roles: string[]): string {
  if (!enabled) return 'Off for everyone.';
  const parts = [
    roles.length ? `people with the role ${roles.join(' or ')}` : null,
    percent !== null ? `${percent}% of everyone` : null,
  ].filter(Boolean);
  return parts.length ? `On for ${parts.join(', plus ')}.` : 'On for everyone.';
}

/**
 * One feature flag (`flags.set`): the master switch, an optional gradual rollout (a stable share of people,
 * 0–100%, that only ever grows) and a role allow-list (those roles always get it). Edits are local until
 * Save; it takes up to ~10 seconds to reach every server (docs/actions.md → Feature flags).
 */
export function FlagCard({
  flag,
  roleOptions,
  canEdit,
}: {
  flag: FlagView;
  roleOptions: string[];
  canEdit: boolean;
}) {
  const { run, pending } = useAction();
  const [enabled, setEnabled] = useState(flag.enabled);
  const [limited, setLimited] = useState(flag.percent !== undefined);
  const [percent, setPercent] = useState(flag.percent ?? 50);
  const [roles, setRoles] = useState<string[]>(flag.roles ?? []);

  const nextPercent = limited ? percent : null;
  const dirty =
    enabled !== flag.enabled ||
    nextPercent !== (flag.percent ?? null) ||
    roles.slice().sort().join() !== (flag.roles ?? []).slice().sort().join();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <code className="text-base">{flag.name}</code>
          {!flag.configured && <Badge color="outline">Default</Badge>}
        </CardTitle>
        <CardDescription>{flag.description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <Switch
          label="Turned on"
          checked={enabled}
          disabled={!canEdit || pending}
          onCheckedChange={(on: boolean) => setEnabled(on)}
        />
        <div className="grid gap-3">
          <Switch
            label="Roll out to a share of people"
            size="sm"
            checked={limited}
            disabled={!canEdit || pending || !enabled}
            onCheckedChange={(on: boolean) => setLimited(on)}
          />
          {limited && (
            <Slider
              label={`Share of people: ${percent}%`}
              min={0}
              max={100}
              step={5}
              value={percent}
              disabled={!canEdit || pending || !enabled}
              onValueChange={(v) => setPercent(Array.isArray(v) ? (v[0] ?? 0) : (v as number))}
            />
          )}
        </div>
        <fieldset className="grid gap-2" disabled={!canEdit || pending || !enabled}>
          <legend className="mb-1 text-sm font-medium">Always on for these roles</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {roleOptions.map((r) => (
              <CheckboxField
                key={r}
                label={<span className="capitalize">{r}</span>}
                checked={roles.includes(r)}
                onChange={(e) =>
                  setRoles((cur) => (e.target.checked ? [...cur, r] : cur.filter((x) => x !== r)))
                }
              />
            ))}
          </div>
        </fieldset>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {who(enabled, nextPercent, roles)}
        </p>
        {canEdit && (
          <div>
            <Button
              variant="primary"
              loading={pending}
              disabled={!dirty}
              onClick={() =>
                run(
                  'flags.set',
                  {
                    name: flag.name,
                    enabled,
                    percent: nextPercent,
                    roles: roles.length ? roles : null,
                  },
                  { success: `Saved ${flag.name}` },
                )
              }
            >
              Save
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
