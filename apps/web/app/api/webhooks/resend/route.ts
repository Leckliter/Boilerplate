import { callAction } from '@app/core';
import { resendWebhook, verifySvix } from '@app/core/notifications';

import { handleWebhook } from '../_lib/handle';

/**
 * POST /api/webhooks/resend — Resend's delivery webhooks (Svix-signed). Add it in Resend →
 * Webhooks with the events email.delivered, email.bounced, email.complained (and email.failed),
 * and put the signing secret (`whsec_…`) in RESEND_WEBHOOK_SECRET. A hard bounce or complaint
 * suppresses the address and emits `email.bounced` (docs/notifications.md → Webhooks).
 */
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  return handleWebhook(req, {
    provider: 'resend',
    secret: process.env.RESEND_WEBHOOK_SECRET,
    verify: ({ secret, headers, body }) => verifySvix({ secret, headers, body }),
    toInput: (json, headers) => {
      const e = json as { type?: unknown; data?: unknown };
      const eventId = headers.get('svix-id');
      if (typeof e.type !== 'string' || !eventId || typeof e.data !== 'object' || !e.data)
        return null;
      return { eventId, type: e.type, data: e.data as Record<string, unknown> };
    },
    run: (input, actor) => callAction(resendWebhook, input, actor),
  });
}
