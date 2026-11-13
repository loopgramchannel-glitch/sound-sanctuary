import { describe, expect, it } from "vitest";
import { continueWatching, isYouTubeEnded, parseStartTime, postShareMeta, recordHistory, shareUrlAt } from "@/lib/growth";
import { Post } from "@/lib/posts";

const p = (id: string, extra = {}) => Post.parse({ id, createdAt: 1, title: "T " + id, ...extra });

describe("share previews", () => {
  it("uses the post title, picture and mp4", () => {
    const m = postShareMeta(p("abc", { imageUrl: "https://media.x/a.jpg", videoUrl: "https://media.x/a.mp4" }));
    expect(m).toContainEqual({ property: "og:title", content: "T abc — LoopgramChannel" });
    expect(m).toContainEqual({ property: "og:image", content: "https://media.x/a.jpg" });
    expect(m).toContainEqual({ property: "og:video", content: "https://media.x/a.mp4" });
  });
  it("YouTube posts without a picture use the YouTube thumbnail", () => {
    expect(postShareMeta(p("abc", { videoUrl: "https://youtu.be/dQw4w9WgXcQ" }))).toContainEqual({ property: "og:image", content: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg" });
  });
  it("omits image tags when there is no absolute picture", () => {
    expect(postShareMeta(p("abc")).some((t) => "property" in t && t.property === "og:image")).toBe(false);
  });
});

describe("timestamp share", () => {
  it("adds t= seconds", () => expect(shareUrlAt("https://x.com/post/a", 45.7)).toBe("https://x.com/post/a?t=45"));
  it("shares from the start under 3 seconds", () => expect(shareUrlAt("https://x.com/post/a?t=9", 1)).toBe("https://x.com/post/a"));
  it("reads 45, 45s, 1m30s", () => {
    expect(parseStartTime("45")).toBe(45);
    expect(parseStartTime("45s")).toBe(45);
    expect(parseStartTime("1m30s")).toBe(90);
    expect(parseStartTime("abc")).toBe(0);
    expect(parseStartTime(null)).toBe(0);
  });
});

describe("up next after YouTube ends", () => {
  it("detects the ended state only", () => {
    expect(isYouTubeEnded(JSON.stringify({ event: "onStateChange", info: 0 }))).toBe(true);
    expect(isYouTubeEnded(JSON.stringify({ event: "infoDelivery", info: { playerState: 0 } }))).toBe(true);
    expect(isYouTubeEnded(JSON.stringify({ event: "onStateChange", info: 1 }))).toBe(false);
    expect(isYouTubeEnded("junk")).toBe(false);
  });
});

describe("continue watching", () => {
  it("newest first, no duplicates, capped at 30", () => {
    let l: ReturnType<typeof recordHistory> = [];
    for (let i = 0; i < 40; i++) l = recordHistory(l, { id: "p" + i, t: 10, d: 100, at: i });
    l = recordHistory(l, { id: "p39", t: 20, d: 100, at: 99 });
    expect(l.length).toBe(30);
    expect(l[0]).toEqual({ id: "p39", t: 20, d: 100, at: 99 });
    expect(l.filter((h) => h.id === "p39").length).toBe(1);
  });
  it("finished videos drop out", () => {
    const l = recordHistory([{ id: "a", t: 10, d: 100, at: 1 }], { id: "a", t: 96, d: 100, at: 2 });
    expect(l).toEqual([]);
  });
  it("skips barely-started and deleted posts", () => {
    const r = continueWatching([{ id: "aaa", t: 2, d: 100, at: 1 }, { id: "bbb", t: 50, d: 100, at: 1 }, { id: "gone", t: 50, d: 100, at: 1 }], [p("aaa"), p("bbb")]);
    expect(r.map((x) => x.post.id)).toEqual(["bbb"]);
    expect(r[0]!.progress).toBe(0.5);
  });
});
