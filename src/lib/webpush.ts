// Web Push (RFC 8291 aes128gcm + RFC 8292 VAPID) using only WebCrypto, so it runs on workerd.
const te = new TextEncoder();
export const b64u = {
  enc: (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
  dec: (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0)),
};
const cat = (...a: Uint8Array[]): Uint8Array<ArrayBuffer> => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };
async function hmac(key: Uint8Array<ArrayBuffer>, data: Uint8Array<ArrayBuffer>) {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, data));
}

/** Encrypts a payload for one subscription (aes128gcm body). */
export async function encryptPayload(payload: Uint8Array, p256dh: string, auth: string, salt = crypto.getRandomValues(new Uint8Array(16))) {
  const uaPub = b64u.dec(p256dh), authS = b64u.dec(auth);
  const as = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
  const asPub = new Uint8Array((await crypto.subtle.exportKey("raw", as.publicKey)) as ArrayBuffer);
  const ua = await crypto.subtle.importKey("raw", uaPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: ua } as EcdhKeyDeriveParams, as.privateKey, 256));
  const ikm = await hmac(await hmac(authS, shared), cat(te.encode("WebPush: info\0"), uaPub, asPub, new Uint8Array([1])));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, cat(te.encode("Content-Encoding: aes128gcm\0"), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, cat(te.encode("Content-Encoding: nonce\0"), new Uint8Array([1])))).slice(0, 12);
  const k = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, k, cat(payload, new Uint8Array([2]))));
  return cat(salt, new Uint8Array([0, 0, 16, 0]), new Uint8Array([asPub.length]), asPub, ct);
}

/** Signed VAPID header for a push service origin. */
export async function vapidAuth(endpoint: string, publicKey: string, privateD: string, subject: string) {
  const pub = b64u.dec(publicKey);
  const key = await crypto.subtle.importKey("jwk", { kty: "EC", crv: "P-256", d: privateD, x: b64u.enc(pub.slice(1, 33)), y: b64u.enc(pub.slice(33, 65)) }, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const h = b64u.enc(te.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const c = b64u.enc(te.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, te.encode(`${h}.${c}`)));
  return `vapid t=${h}.${c}.${b64u.enc(sig)}, k=${publicKey}`;
}

export type Sub = { endpoint: string; p256dh: string; auth: string };
/** Sends one push. Returns HTTP status (404/410 = subscription gone). */
export async function sendPush(sub: Sub, data: unknown, keys: { pub: string; priv: string; subject: string }): Promise<number> {
  const body = await encryptPayload(te.encode(JSON.stringify(data)), sub.p256dh, sub.auth);
  const r = await fetch(sub.endpoint, {
    method: "POST", signal: AbortSignal.timeout(8000),
    headers: { "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", TTL: "86400", Urgency: "high", Authorization: await vapidAuth(sub.endpoint, keys.pub, keys.priv, keys.subject) },
    body,
  });
  return r.status;
}
