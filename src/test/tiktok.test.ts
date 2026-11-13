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
