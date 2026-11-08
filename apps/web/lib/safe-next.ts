/** Only allow same-site relative redirects (blocks `?next=https://evil.com`). */
export function safeNext(value: string | null | undefined, fallback = '/account') {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')
    ? value
    : fallback;
}
