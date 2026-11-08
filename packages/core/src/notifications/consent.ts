import { appName } from '../messaging/email-layout';

/**
 * The exact wording people agree to for texts. It is stored with their consent (contacts.
 * sms_consent_text), so change it freely: new consents store the new text, old ones keep what
 * was shown to them. Keep the opt-out and rates lines — carriers expect them.
 */
export const smsConsentText = () =>
  `Text me updates from ${appName()}. Message frequency varies. Msg & data rates may apply. ` +
  'Reply STOP to opt out, HELP for help.';

/** Every text ends with the opt-out line (carriers need the keyword STOP in it). */
export const SMS_OPT_OUT = 'Reply STOP to opt out.';

/** The full text as it goes out: `<App name>: <message> Reply STOP to opt out.` */
export const smsText = (message: string) => `${appName()}: ${message} ${SMS_OPT_OUT}`;
