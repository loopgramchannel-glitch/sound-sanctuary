import { describe, expect, it } from "vitest";
import { Post, postIsEmpty, sortPosts } from "@/lib/posts";

const p = (id: string, createdAt: number, pinned = false) => Post.parse({ id, createdAt, pinned, text: "x" });

describe("owner posts", () => {
  it("pinned posts come first, then newest", () => {
    expect(sortPosts([p("aaa", 1), p("bbb", 3), p("ccc", 2, true)]).map((x) => x.id)).toEqual(["ccc", "bbb", "aaa"]);
  });
  it("a post with nothing in it is empty", () => {
    expect(postIsEmpty({ title: "", text: "", videoUrl: "", imageUrl: "" })).toBe(true);
    expect(postIsEmpty({ title: "", text: "", videoUrl: "https://x/v.mp4", imageUrl: "" })).toBe(false);
  });
});

import { findDuplicate as fd, sourceKey as sk } from "@/lib/posts";
describe("already-saved video detection", () => {
  it("gives the same key for any form of one TikTok link", () => {
    expect(sk("https://www.tiktok.com/@nasa/video/7301234567890123456?is_from=x")).toBe("tiktok:7301234567890123456");
  });
  it("gives the same key for YouTube watch and shorts links", () => {
    expect(sk("https://youtu.be/dQw4w9WgXcQ")).toBe("youtube:dQw4w9WgXcQ");
    expect(sk("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("youtube:dQw4w9WgXcQ");
  });
  it("finds older account-imported posts by their id", () => {
    const list = [{ id: "tt-7301234567890123456", source: "", videoUrl: "https://media.x/a.mp4", title: "A" }];
    expect(fd(list, "tiktok:7301234567890123456")?.title).toBe("A");
    expect(fd(list, "tiktok:1")).toBeUndefined();
  });
});
