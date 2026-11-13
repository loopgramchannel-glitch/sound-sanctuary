import { describe, expect, it } from "vitest";
import { b64u, encryptPayload, vapidAuth } from "./webpush";
import { isPushEndpoint } from "./push-keys";

const te = new TextEncoder();
async function hmac(k: Uint8Array<ArrayBuffer>, d: Uint8Array<ArrayBuffer>) { return new Uint8Array(await crypto.subtle.sign("HMAC", await crypto.subtle.importKey("raw", k, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]), d)); }
const cat = (...a: Uint8Array[]) => Uint8Array.from(a.flatMap((x) => [...x]));

describe("web push", () => {
  it("a phone can decrypt the message we send", async () => {
    const ua = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
    const uaPub = new Uint8Array((await crypto.subtle.exportKey("raw", ua.publicKey)) as ArrayBuffer);
    const auth = crypto.getRandomValues(new Uint8Array(16));
    const body = await encryptPayload(te.encode('{"title":"New video"}'), b64u.enc(uaPub), b64u.enc(auth));
    const salt = body.slice(0, 16), asPub = body.slice(21, 86), ct = body.slice(86);
    const asKey = await crypto.subtle.importKey("raw", asPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
    const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: asKey } as EcdhKeyDeriveParams, ua.privateKey, 256));
    const ikm = await hmac(await hmac(auth, shared), cat(te.encode("WebPush: info\0"), uaPub, asPub, new Uint8Array([1])));
    const prk = await hmac(salt, ikm);
    const cek = (await hmac(prk, cat(te.encode("Content-Encoding: aes128gcm\0"), new Uint8Array([1])))).slice(0, 16);
    const nonce = (await hmac(prk, cat(te.encode("Content-Encoding: nonce\0"), new Uint8Array([1])))).slice(0, 12);
    const pt = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]), ct));
    expect(new TextDecoder().decode(pt.slice(0, -1))).toBe('{"title":"New video"}');
  });
  it("signs a valid VAPID token", async () => {
    const kp = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
    const jwk = await crypto.subtle.exportKey("jwk", kp.privateKey);
    const pub = b64u.enc(new Uint8Array((await crypto.subtle.exportKey("raw", kp.publicKey)) as ArrayBuffer));
    const h = await vapidAuth("https://fcm.googleapis.com/fcm/send/x", pub, jwk.d!, "mailto:a@b.c");
    const [, t] = h.match(/t=([^,]+)/)!; const [a, b, s] = t!.split(".");
    expect(await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, kp.publicKey, b64u.dec(s!), te.encode(`${a}.${b}`))).toBe(true);
    expect(JSON.parse(new TextDecoder().decode(b64u.dec(b!))).aud).toBe("https://fcm.googleapis.com");
  });
  it("only accepts real push services", () => {
    expect(isPushEndpoint("https://fcm.googleapis.com/fcm/send/abc")).toBe(true);
    expect(isPushEndpoint("https://web.push.apple.com/x")).toBe(true);
    expect(isPushEndpoint("https://evil.com/fcm.googleapis.com")).toBe(false);
    expect(isPushEndpoint("http://fcm.googleapis.com/x")).toBe(false);
  });
});
