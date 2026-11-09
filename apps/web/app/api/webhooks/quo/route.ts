import { callAction } from '@app/core';
import { quoWebhook, verifyQuo } from '@app/core/notifications';

import { handleWebhook } from '../_lib/handle';

/**
 * POST /api/webhooks/quo — Quo (OpenPhone) message webhooks. Create the webhook in Quo with the
 * events message.received and message.delivered; put its signing key in QUO_WEBHOOK_SECRET. Inbound texts
 * become `sms.received` events; STOP / START words clear / restore SMS consent (docs/notifications.md →
 * Webhooks). Signed requests carry `openphone-signature`; otherwise send the same secret as `x-webhook-secret`.
 */
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  return handleWebhook(req, {
    provider: 'quo',
    secret: process.env.QUO_WEBHOOK_SECRET,
    verify: ({ secret, headers, body }) => verifyQuo({ secret, headers, body }),
    toInput: (json) => {
      const e = json as { id?: unknown; type?: unknown; data?: unknown };
      if (typeof e.type !== 'string' || typeof e.data !== 'object' || !e.data) return null;
      const data = e.data as Record<string, unknown>;
      const inner = data.object as { id?: unknown } | undefined;
      const eventId =
        typeof e.id === 'string' ? e.id : typeof inner?.id === 'string' ? inner.id : null;
      return eventId ? { eventId, type: e.type, data } : null;
    },
    run: (input, actor) => callAction(quoWebhook, input, actor),
  });
}
