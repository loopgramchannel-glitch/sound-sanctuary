import { describe, expect, it } from "vitest";
import { isTikTokUrl } from "@/lib/tiktok";

describe("isTikTokUrl", () => {
  it("accepts TikTok video and short links", () => {
    expect(isTikTokUrl("https://www.tiktok.com/@a/video/123")).toBe(true);
    expect(isTikTokUrl("https://vm.tiktok.com/ZMabc/")).toBe(true);
  });
  it("rejects other sites", () => {
    expect(isTikTokUrl("https://evil-tiktok.com/x")).toBe(false);
    expect(isTikTokUrl("https://youtube.com/watch?v=1")).toBe(false);
  });
});

import { youTubeId } from "@/lib/tiktok";
describe("youTubeId", () => {
  it("reads ids from all YouTube link shapes", () => {
    expect(youTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3")).toBe("dQw4w9WgXcQ");
    expect(youTubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youTubeId("https://youtube.com/shorts/dQw4w9WgXcQ?si=x")).toBe("dQw4w9WgXcQ");
  });
  it("rejects other sites and bad ids", () => {
    expect(youTubeId("https://evilyoutube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(youTubeId("https://youtube.com/watch?v=short")).toBeNull();
  });
});

import { isCleanPlay, tiktokHandle, videoLinks } from "@/lib/tiktok-account";
describe("tiktok account import", () => {
  it("drops photo slideshows and posts without a clean stream", () => {
    expect(isCleanPlay({ images: ["a.jpg"], play: "x" })).toBe(false);
    expect(isCleanPlay({})).toBe(false);
    expect(isCleanPlay({ hdplay: "x" })).toBe(true);
  });
  it("reads usernames from @name and profile links", () => {
    expect(tiktokHandle("@loop.gram")).toBe("loop.gram");
    expect(tiktokHandle("https://www.tiktok.com/@abc_1?lang=en")).toBe("abc_1");
    expect(tiktokHandle("not a name!")).toBeNull();
  });
  it("dedupes pasted links by video id", () => {
    expect(videoLinks("https://www.tiktok.com/@a/video/1 https://www.tiktok.com/@a/video/1?x=1 https://x.com/y")).toHaveLength(1);
  });
});

describe("bulk import capacity", () => {
  it("reads all 10,000 pasted links", async () => {
    const { videoLinks } = await import("@/lib/tiktok-account");
    const text = Array.from({ length: 10000 }, (_, i) => `https://www.tiktok.com/@a/video/${7000000000000000000n + BigInt(i)}`).join("\n");
    expect(videoLinks(text)).toHaveLength(10000);
  });
  it("bookmarklet is a valid javascript link", async () => {
    const { COLLECT_BOOKMARKLET } = await import("@/lib/tiktok-account");
    expect(COLLECT_BOOKMARKLET.startsWith("javascript:")).toBe(true);
    expect(() => new Function(decodeURIComponent(COLLECT_BOOKMARKLET.slice(11)))).not.toThrow();
  });
});
