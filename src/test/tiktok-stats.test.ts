import { describe, expect, it } from "vitest";
import { VIEW_AFTER_SHORT_S, VIEW_AFTER_VIDEO_S, VIEW_DEDUPE_S, VIEW_REPLAY_S, nextVote, voteDelta } from "@/lib/post-stats";
import { StatBuffer } from "@/lib/stat-buffer";

describe("TikTok-style views and likes", () => {
  it("counts a view after 1 second", () => { expect(VIEW_AFTER_SHORT_S).toBe(1); expect(VIEW_AFTER_VIDEO_S).toBe(1); });
  it("counts a replay of the same viewer after the short window", () => {
    const b = new StatBuffer(VIEW_DEDUPE_S * 1000);
    expect(b.view("p1", "viewer-aaaaaaaaaaaaaaaa", 0)).toBe(true);
    expect(b.view("p1", "viewer-aaaaaaaaaaaaaaaa", 1000)).toBe(false);
    expect(b.view("p1", "viewer-aaaaaaaaaaaaaaaa", VIEW_REPLAY_S * 1000)).toBe(true);
  });
  it("like is a toggle: tap twice returns to zero", () => {
    expect(nextVote(0, 1)).toBe(1); expect(nextVote(1, 1)).toBe(0);
    expect(voteDelta(0, 1).likes).toBe(1); expect(voteDelta(1, 0).likes).toBe(-1);
  });
});
