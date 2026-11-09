/** Tiny standalone HTML pages for the email-link routes (confirm / unsubscribe): no app shell, no JS. */
export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const page = (title: string, body: string, status = 200) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>body{font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;line-height:1.5}button{font:inherit;padding:.6rem 1rem}</style></head>
<body><h1>${esc(title)}</h1>${body}</body></html>`,
    {
      status,
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
    },
  );

/** The origin to redirect to: the configured public URL when set, else the one the request came in on. */
export const publicOrigin = (req: Request) =>
  process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
