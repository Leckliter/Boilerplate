import { contacts, eq, messageSuppressions, type Tx } from '@app/db';

/**
 * Stop messaging an address (hard bounce, spam complaint, a STOP reply). A STOP also withdraws
 * the SMS consent recorded for that phone number. Shared by `notifications.recordSuppression`
 * and the provider webhook actions so both behave the same.
 */
export async function suppressAddress(
  tx: Tx,
  s: {
    channel: 'email' | 'sms';
    address: string;
    reason: 'bounce' | 'complaint' | 'stop' | 'manual';
    detail?: string;
  },
) {
  const address = s.address.toLowerCase();
  await tx
    .insert(messageSuppressions)
    .values({ channel: s.channel, address, reason: s.reason, detail: s.detail })
    .onConflictDoNothing();
  if (s.channel === 'sms' && s.reason === 'stop') {
    await tx
      .update(contacts)
      .set({ smsConsentAt: null, smsConsentSource: null, smsConsentText: null })
      .where(eq(contacts.phone, s.address));
  }
  return address;
}
