'use client';

import { useEffect, useRef } from 'react';

/** The public site key (a build-time variable); without it the human check is off everywhere. */
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

type Turnstile = {
  render: (el: HTMLElement, opts: { sitekey: string; theme?: string }) => string;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

let loading: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error('Could not load the human check.'));
    };
    document.head.append(s);
  });
  return loading;
}

/**
 * Cloudflare Turnstile for public forms (the `humanCheck` of `inquiries.create` / `newsletter.subscribe`).
 * Renders only when NEXT_PUBLIC_TURNSTILE_SITE_KEY is set; Turnstile adds its answer to the surrounding form
 * as `cf-turnstile-response`, which <ActionForm humanCheck> sends along. Loaded on demand, only on forms
 * that ask for it, so pages without a form load no third-party script.
 */
export function TurnstileWidget() {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!SITE_KEY || !box.current) return;
    let id: string | null = null;
    let live = true;
    loadScript()
      .then(() => {
        if (live && box.current && window.turnstile) {
          id = window.turnstile.render(box.current, { sitekey: SITE_KEY, theme: 'auto' });
        }
      })
      .catch(() => {
        // Expected: blocked by an ad blocker or offline. The form still submits; the server decides.
      });
    return () => {
      live = false;
      if (id && window.turnstile) window.turnstile.remove(id);
    };
  }, []);
  return SITE_KEY ? <div ref={box} /> : null;
}
