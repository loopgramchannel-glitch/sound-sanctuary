// Public half of the site's own Web Push (VAPID) key. The private half is the VAPID_PRIVATE_KEY secret.
export const VAPID_PUBLIC_KEY = "BGlyH1DWjIRj7cWuCMwka9ohBClbMoVpNsfb34qgqPBdYUjeFUyMiqBb33gppUHLc9788FKYIfnlN97avMLZoZw";
/** Only real browser push services; blocks the server being used to call arbitrary URLs. */
export function isPushEndpoint(u: string): boolean {
  try {
    const h = new URL(u);
    return h.protocol === "https:" && /(^|\.)(fcm\.googleapis\.com|android\.googleapis\.com|push\.services\.mozilla\.com|push\.apple\.com|notify\.windows\.com)$/.test(h.hostname);
  } catch { return false; }
}
