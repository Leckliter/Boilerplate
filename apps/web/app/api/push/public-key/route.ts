import { pushPublicKey } from '@app/core/notifications';

export const dynamic = 'force-dynamic';

/**
 * GET /api/push/public-key — the VAPID public key a browser needs for `pushManager.subscribe`
 * (`applicationServerKey`). Public on purpose: it is a public key. `configured: false` when push
 * isn't set up here (VAPID_* missing), so the UI can hide the "turn on notifications" button.
 */
export async function GET() {
  const publicKey = pushPublicKey();
  return Response.json(
    { configured: publicKey !== null, publicKey },
    { headers: { 'Cache-Control': 'public, max-age=300' } },
  );
}
