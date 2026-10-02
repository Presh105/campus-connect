/**
 * A random, anonymous ID that is created once per browser/device and kept in
 * both localStorage and a long-lived cookie. It is sent at sign-up and sign-in
 * so the database can spot someone "referring" themselves from the same device.
 *
 * Note: a browser cannot write a real hidden file, so this is the closest safe
 * equivalent. Clearing site data or using private mode creates a new ID, so
 * this is a deterrent, not a guarantee.
 */
const KEY = 'cc_device_id';

function readCookie(): string | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${KEY}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

function writeCookie(value: string) {
  const twoYears = 60 * 60 * 24 * 730;
  document.cookie = `${KEY}=${encodeURIComponent(value)}; max-age=${twoYears}; path=/; SameSite=Lax; Secure`;
}

export function getDeviceId(): string {
  let id: string | null = null;
  try { id = localStorage.getItem(KEY); } catch { /* storage blocked */ }
  if (!id) id = readCookie();
  if (!id) {
    id = (crypto as any).randomUUID
      ? crypto.randomUUID()
      : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
  }
  // Keep both copies in sync so losing one doesn't lose the ID
  try { localStorage.setItem(KEY, id); } catch { /* ignore */ }
  writeCookie(id);
  return id;
}
