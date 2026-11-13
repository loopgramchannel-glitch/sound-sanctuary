import { describe, it, expect } from "vitest";
import { isInstalledEnv } from "@/lib/pwa-install";

describe("install button hides once installed", () => {
  it("shows in a normal browser tab", () => expect(isInstalledEnv({ modes: [], stored: null })).toBe(false));
  it("hides in installed app window", () => expect(isInstalledEnv({ modes: ["standalone"] })).toBe(true));
  it("hides on desktop window-controls-overlay", () => expect(isInstalledEnv({ modes: ["window-controls-overlay"] })).toBe(true));
  it("hides on iPhone home screen app", () => expect(isInstalledEnv({ modes: [], iosStandalone: true })).toBe(true));
  it("hides in browser tab after installing", () => expect(isInstalledEnv({ modes: [], stored: "1" })).toBe(true));
});
