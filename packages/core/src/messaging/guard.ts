import { getAppEnv } from '../env';

/**
 * Safety net: outside production, email and SMS may ONLY go to the addresses and numbers listed
 * in TEST_RECIPIENTS_EMAIL / TEST_RECIPIENTS_SMS (comma-separated). Anything else is logged and
 * skipped — never sent. This protects real people even if a real address sneaks into a test
 * database. Production is unrestricted.
 */
export function isRecipientAllowed(channel: 'email' | 'sms', to: string): boolean {
  if (getAppEnv() === 'production') return true;
  const list =
    (channel === 'email' ? process.env.TEST_RECIPIENTS_EMAIL : process.env.TEST_RECIPIENTS_SMS) ??
    '';
  const allowed = list
    .split(',')
    .map((s) => normalize(channel, s))
    .filter(Boolean);
  return allowed.includes(normalize(channel, to));
}

function normalize(channel: 'email' | 'sms', value: string) {
  const v = value.trim().toLowerCase();
  if (channel === 'sms') return v.replace(/[^\d+]/g, '');
  // you+seed3@gmail.com is allowed when you@gmail.com is.
  return v.replace(/\+[^@]*@/, '@');
}
