/**
 * Makes a link safe to open in a new tab.
 * "example.com" or "www.example.com" would otherwise be treated as a path on
 * this site (connet.com.ng/example.com) instead of the real website.
 */
export function normalizeUrl(raw?: string | null): string {
  const v = (raw || '').trim();
  if (!v) return '';
  if (/^(https?:\/\/|mailto:|tel:)/i.test(v)) return v;
  if (v.startsWith('//')) return `https:${v}`;
  return `https://${v.replace(/^\/+/, '')}`;
}
