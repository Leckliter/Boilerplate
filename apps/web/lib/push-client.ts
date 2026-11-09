import { invokeAction } from './invoke';

/**
 * Browser side of Web Push (docs/notifications.md → Push). Everything here is on demand: the service worker
 * (public/sw.js) is registered only when someone presses "Turn on", never on page load.
 */
export type PushState =
  | 'checking'
  | 'unsupported' // this browser has no service workers / Push API / Notification
  | 'not-configured' // the server has no VAPID keys
  | 'denied' // the person blocked notifications in the browser
  | 'off' // available, not turned on for this device
  | 'on'; // this device is subscribed

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  return reg ? reg.pushManager.getSubscription() : null;
}

/** Is push configured on the server (VAPID public key)? */
async function publicKey(): Promise<string | null> {
  const res = await fetch('/api/push/public-key');
  if (!res.ok) return null;
  const body = (await res.json()) as { configured: boolean; publicKey: string | null };
  return body.configured ? body.publicKey : null;
}

/** Where this device stands right now. */
export async function readPushState(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported';
  if (!(await publicKey())) return 'not-configured';
  if (Notification.permission === 'denied') return 'denied';
  return (await currentSubscription()) ? 'on' : 'off';
}

const urlBase64ToBytes = (base64: string) => {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

const toBase64Url = (buf: ArrayBuffer | null) =>
  buf
    ? btoa(String.fromCharCode(...new Uint8Array(buf)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')
    : '';

/** A short name for the device, e.g. "Chrome on Android" (stored with the subscription so people can tell devices apart). */
export function deviceLabel(): string {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Firefox\//.test(ua)
      ? 'Firefox'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Safari\//.test(ua)
          ? 'Safari'
          : 'Browser';
  const os = /Android/.test(ua)
    ? 'Android'
    : /iPhone|iPad/.test(ua)
      ? 'iOS'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Mac OS X/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : '';
  return os ? `${browser} on ${os}` : browser;
}

export type PushResult = { ok: true } | { ok: false; message: string; ref?: string };

/** Ask permission, subscribe this browser and save the subscription (`push.subscribe`). */
export async function enablePush(): Promise<PushResult> {
  if (!pushSupported())
    return { ok: false, message: 'This browser can’t receive push notifications.' };
  const key = await publicKey();
  if (!key) return { ok: false, message: 'Push notifications aren’t set up on this site yet.' };
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return {
      ok: false,
      message:
        'Notifications are blocked for this site. Allow them in your browser’s site settings, then try again.',
    };
  }
  await navigator.serviceWorker.register('/sw.js');
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToBytes(key),
    }));
  const saved = await invokeAction('push.subscribe', {
    endpoint: sub.endpoint,
    keys: { p256dh: toBase64Url(sub.getKey('p256dh')), auth: toBase64Url(sub.getKey('auth')) },
    label: deviceLabel(),
  });
  if (!saved.ok) {
    // Don't leave a browser subscription the server doesn't know about.
    await sub.unsubscribe();
    return { ok: false, message: saved.error.message, ref: saved.error.ref };
  }
  return { ok: true };
}

/** Forget this device (`push.unsubscribe`) and drop the browser's subscription. */
export async function disablePush(): Promise<PushResult> {
  const sub = pushSupported() ? await currentSubscription() : null;
  if (!sub) return { ok: true };
  const removed = await invokeAction('push.unsubscribe', { endpoint: sub.endpoint });
  if (!removed.ok) return { ok: false, message: removed.error.message, ref: removed.error.ref };
  await sub.unsubscribe();
  return { ok: true };
}
