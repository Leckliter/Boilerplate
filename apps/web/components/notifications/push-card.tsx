'use client';

import { Button } from '@app/ui/components/button';
import { Callout } from '@app/ui/components/callout';
import { BellRingingIcon, BellSlashIcon } from '@app/ui/components/icons';
import { toast } from '@app/ui/components/toaster';
import { formatDate } from '@app/ui/lib/dates';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { disablePush, enablePush, type PushState, readPushState } from '@/lib/push-client';
import { toastActionError } from '@/lib/use-action';

type Device = { id: string; label: string | null; endpointHost: string; createdAt: string };

/**
 * Turn push notifications on or off for THIS device (Account → Notifications). The service worker is only
 * registered when the person presses "Turn on" (lib/push-client.ts); until then the page does nothing
 * with push. Each unsupported or blocked state says what to do instead of leaving a dead button.
 */
export function PushCard({ devices }: { devices: Device[] }) {
  const router = useRouter();
  const [state, setState] = useState<PushState>('checking');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    readPushState()
      .then((s) => live && setState(s))
      .catch(() => {
        // Expected: a browser that refuses service workers (private mode). Treat it as unsupported.
        if (live) setState('unsupported');
      });
    return () => {
      live = false;
    };
  }, []);

  async function toggle(turnOn: boolean) {
    setBusy(true);
    try {
      const res = turnOn ? await enablePush() : await disablePush();
      if (!res.ok) {
        toastActionError(res.message, res.ref);
      } else {
        toast.success(
          turnOn
            ? 'Push notifications are on for this device'
            : 'Push notifications are off for this device',
        );
      }
      setState(await readPushState());
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4">
      {state === 'unsupported' && (
        <Callout tone="info">
          This browser can’t receive push notifications. On an iPhone, add the site to your Home
          Screen first, then turn it on from there.
        </Callout>
      )}
      {state === 'not-configured' && (
        <Callout tone="info">
          Push notifications aren’t set up on this site yet. An admin needs to add the VAPID keys.
        </Callout>
      )}
      {state === 'denied' && (
        <Callout tone="warning">
          Notifications are blocked for this site in your browser. Allow them in the site settings
          (the lock icon by the address), then come back and turn them on.
        </Callout>
      )}
      {state === 'off' && (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            icon={<BellRingingIcon />}
            loading={busy}
            onClick={() => toggle(true)}
          >
            Turn on for this device
          </Button>
          <span className="text-sm text-muted-foreground">
            Your browser will ask for permission.
          </span>
        </div>
      )}
      {state === 'on' && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm">
            <strong>On</strong> for this device.
          </p>
          <Button icon={<BellSlashIcon />} loading={busy} onClick={() => toggle(false)}>
            Turn off for this device
          </Button>
        </div>
      )}
      {devices.length > 0 && (
        <div className="grid gap-1.5">
          <p className="text-sm font-medium">Devices that get push notifications</p>
          <ul className="grid gap-1 text-sm text-muted-foreground">
            {devices.map((d) => (
              <li key={d.id}>
                {d.label ?? d.endpointHost} · since {formatDate(d.createdAt)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
