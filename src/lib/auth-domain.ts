// Google's sign-in window shows the auth domain ("continue to …"). On our own
// site we use our own domain and the worker proxies /__/auth/* to Firebase,
// so visitors see loopgramchannel.com instead of <project>.firebaseapp.com.
export const OWN_AUTH_HOSTS = ["loopgramchannel.com", "www.loopgramchannel.com"];

export function pickAuthDomain(currentHost: string | null | undefined, firebaseDomain: string): string {
  const h = (currentHost ?? "").toLowerCase();
  return OWN_AUTH_HOSTS.includes(h) ? h : firebaseDomain;
}

export function isFirebaseAuthPath(pathname: string): boolean {
  return pathname.startsWith("/__/auth/") || pathname.startsWith("/__/firebase/");
}
