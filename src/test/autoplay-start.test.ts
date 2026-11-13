import { describe, it, expect } from "vitest";
import { withAutoplay } from "@/components/PostView";

describe("videos start fresh from 0:00", () => {
  it("embeds autoplay at 0:00 and drop old timestamps", () => {
    const u = new URL(withAutoplay("https://www.youtube.com/embed/abc?t=95"));
    expect(u.searchParams.get("autoplay")).toBe("1");
    expect(u.searchParams.get("start")).toBe("0");
    expect(u.searchParams.has("t")).toBe(false);
  });
});
