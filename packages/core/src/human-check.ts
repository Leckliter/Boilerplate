/**
 * "Are you a person?" check for public forms (Cloudflare Turnstile).
 *
 * Off until `TURNSTILE_SECRET_KEY` (server) and
 * `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (browser widget) are set. Then actions
 * marked `humanCheck` refuse guests whose request carries no valid token
 * (`RequestInfo.humanToken`). Signed-in people, API keys and the system are
 * never asked.
 */
export const humanCheckEnabled = () => Boolean(process.env.TURNSTILE_SECRET_KEY);

type Verifier = (token: string, ip: string | null) => Promise<boolean>;

let verifierOverride: Verifier | null = null;

/** Tests: replace the call to Cloudflare (null restores it). */
export function setHumanVerifierForTests(v: Verifier | null) {
  verifierOverride = v;
}

/** True when Cloudflare confirms the token. Tokens are single-use and expire after 5 minutes. */
export async function verifyHuman(token: string, ip: string | null): Promise<boolean> {
  if (verifierOverride) return verifierOverride(token, ip);
  const body = new URLSearchParams({
    secret: process.env.TURNSTILE_SECRET_KEY ?? '',
    response: token,
  });
  if (ip) body.set('remoteip', ip);
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body,
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Turnstile siteverify returned HTTP ${res.status}`);
  const data = (await res.json()) as { success?: boolean };
  return data.success === true;
}
