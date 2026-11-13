import { describe, expect, it } from "vitest";
import { pickAuthDomain, isFirebaseAuthPath } from "./auth-domain";

const FB = "loopgramchannel-a0343.firebaseapp.com";
describe("auth domain", () => {
  it("uses our own domain on loopgramchannel.com", () => {
    expect(pickAuthDomain("loopgramchannel.com", FB)).toBe("loopgramchannel.com");
    expect(pickAuthDomain("www.loopgramchannel.com", FB)).toBe("www.loopgramchannel.com");
  });
  it("falls back to Firebase domain elsewhere (preview, localhost)", () => {
    expect(pickAuthDomain("id-preview--x.lovable.app", FB)).toBe(FB);
    expect(pickAuthDomain(undefined, FB)).toBe(FB);
  });
  it("proxies only Firebase auth paths", () => {
    expect(isFirebaseAuthPath("/__/auth/handler")).toBe(true);
    expect(isFirebaseAuthPath("/__/firebase/init.json")).toBe(true);
    expect(isFirebaseAuthPath("/login")).toBe(false);
  });
});
