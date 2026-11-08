'use client';

import { Switch } from '@app/ui/components/switch';

import { useAction } from '@/lib/use-action';

type Channel = 'email' | 'sms' | 'push';
export type PreferenceType = {
  key: string;
  label: string;
  description: string;
  channels: Record<Channel, { enabled: boolean; locked: boolean }>;
};

const CHANNEL_LABELS: Record<Channel, string> = { email: 'Email', sms: 'Text', push: 'Push' };

/**
 * One row per kind of message, one switch per channel (`notifications.setPreference`). Required
 * emails (receipts, security) are locked on. A text switch only does something once the person has
 * agreed to texts (the consent card above).
 */
export function PreferenceGrid({ types }: { types: PreferenceType[] }) {
  const { run, pending } = useAction();
  return (
    <ul className="grid divide-y divide-hairline">
      {types.map((t) => (
        <li
          key={t.key}
          className="grid gap-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[1fr_auto] sm:items-center"
        >
          <div className="min-w-0">
            <p className="font-medium">{t.label}</p>
            <p className="text-sm text-muted-foreground">{t.description}</p>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {(Object.keys(CHANNEL_LABELS) as Channel[]).map((c) => (
              <Switch
                key={c}
                size="sm"
                label={CHANNEL_LABELS[c]}
                checked={t.channels[c].enabled}
                disabled={pending || t.channels[c].locked}
                onCheckedChange={(enabled: boolean) =>
                  void run('notifications.setPreference', { type: t.key, channel: c, enabled })
                }
              />
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}
