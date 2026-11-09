import { guestActor } from '@app/core';
import { vi } from 'vitest';

// Route tests send credentials (a bearer key) or none at all: there is never a browser session. The
// real getActor() reads Next's request cookies, which do not exist outside a request.
vi.mock('@/lib/viewer', () => ({ getActor: async () => guestActor('web') }));

process.env.CRON_SECRET = 'cron-secret-for-tests-0123456789';
process.env.RESEND_WEBHOOK_SECRET = `whsec_${Buffer.from('resend-test-signing-key').toString('base64')}`;
process.env.QUO_WEBHOOK_SECRET = Buffer.from('quo-test-signing-key').toString('base64');
process.env.NOTIFICATIONS_SECRET = 'notifications-secret-for-tests';
for (const name of [
  'VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
  'VAPID_SUBJECT',
  'S3_ENDPOINT',
  'RESEND_API_KEY',
  'QUO_API_KEY',
]) {
  delete process.env[name];
}
process.env.LOG_LEVEL = 'silent';
