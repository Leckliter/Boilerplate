/**
 * THE one email layout: name line, title, paragraphs, an optional button, and a footer with
 * "manage notifications" (+ unsubscribe for optional types). Every notification email uses it —
 * restyle your emails here. Inline styles only: email clients ignore stylesheets and cannot read
 * CSS variables, so the brand colour is a literal that you keep in step with `--brand-500` in
 * packages/ui/src/styles/globals.css.
 */
export type EmailContent = {
  title: string;
  body: string;
  /** Extra paragraphs after the body. */
  emailLines?: string[];
  /** Path or URL for the button. */
  url?: string;
  /** Button label (default "Open"). */
  action?: string;
};

/** The name shown in emails and texts. Set APP_NAME; the owner renames it with the app. */
export function appName(): string {
  return process.env.APP_NAME?.trim() || 'Your App';
}

const BRAND = '#6366f1'; // rules-ok: no-raw-colour — emails cannot read CSS variables; mirrors --brand-500
const INK = '#18181b'; // rules-ok: no-raw-colour — email inline style
const MUTED = '#71717a'; // rules-ok: no-raw-colour — email inline style
const PAGE = '#f4f4f5'; // rules-ok: no-raw-colour — email inline style

export function renderEmail(
  c: EmailContent,
  links: { siteUrl: string; preferencesUrl: string; unsubscribeUrl?: string },
): { html: string; text: string } {
  const href = c.url ? absoluteUrl(c.url, links.siteUrl) : null;
  const paragraphs = [c.body, ...(c.emailLines ?? [])];
  const name = appName();
  const html = `<!doctype html>
<html><body style="margin:0;background:${PAGE};font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${INK}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;padding:28px">
<tr><td style="font-weight:600;font-size:15px;color:${BRAND}">${esc(name)}</td></tr>
<tr><td style="padding-top:20px;font-size:20px;font-weight:600;line-height:1.3">${esc(c.title)}</td></tr>
${paragraphs.map((p) => `<tr><td style="padding-top:12px;font-size:15px;line-height:1.55">${esc(p)}</td></tr>`).join('\n')}
${
  href
    ? `<tr><td style="padding-top:24px"><a href="${esc(href)}" style="display:inline-block;background:${BRAND};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:11px 18px;border-radius:8px">${esc(c.action ?? 'Open')}</a></td></tr>`
    : ''
}
</table>
<p style="max-width:560px;font-size:12px;line-height:1.5;color:${MUTED};padding:16px 8px 0;margin:0">
${esc(name)}<br>
<a href="${esc(links.preferencesUrl)}" style="color:${MUTED}">Manage notifications</a>${
    links.unsubscribeUrl
      ? ` · <a href="${esc(links.unsubscribeUrl)}" style="color:${MUTED}">Unsubscribe from these emails</a>`
      : ''
  }
</p>
</td></tr></table></body></html>`;
  const text = [
    c.title,
    '',
    ...paragraphs,
    ...(href ? ['', `${c.action ?? 'Open'}: ${href}`] : []),
    '',
    `Manage notifications: ${links.preferencesUrl}`,
    ...(links.unsubscribeUrl ? [`Unsubscribe: ${links.unsubscribeUrl}`] : []),
  ].join('\n');
  return { html, text };
}

export const absoluteUrl = (url: string, siteUrl: string) =>
  /^https?:\/\//.test(url) ? url : `${siteUrl}${url.startsWith('/') ? '' : '/'}${url}`;

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
