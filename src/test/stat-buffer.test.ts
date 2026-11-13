import { describe, expect, it } from "vitest";
import { StatBuffer } from "@/lib/stat-buffer";
import { searchPosts } from "@/lib/local-search";

describe("view & like buffer (Cloudflare D1, no Upstash)", () => {
  it("10,000 viewers of one video become one database write", () => {
    const b = new StatBuffer(30 * 60_000);
    for (let i = 0; i < 10_000; i++) b.view("p-1", `viewer-${i}`, 0);
    const { stmts } = b.drain(0);
    expect(stmts).toHaveLength(1);
    expect(stmts[0]!.params[1]).toBe(10_000);
  });
  it("same viewer within 30 minutes counts once, after 30 minutes counts again", () => {
    const b = new StatBuffer(30 * 60_000);
    expect(b.view("p-1", "v", 0)).toBe(true);
    expect(b.view("p-1", "v", 29 * 60_000)).toBe(false);
    expect(b.view("p-1", "v", 31 * 60_000)).toBe(true);
  });
  it("double taps by one viewer keep only the last thumb", () => {
    const b = new StatBuffer(1000);
    b.vote("p-1", "v", 1); b.vote("p-1", "v", 0); b.vote("p-1", "v", 1);
    expect(b.drain(0).stmts).toHaveLength(3); // one vote = 3 statements
  });
  it("a failed write keeps the counts for the next try", () => {
    const b = new StatBuffer(1000);
    b.view("p-1", "a", 0); b.view("p-1", "b", 0);
    b.drain(0).restore();
    expect(b.pendingViews("p-1")).toBe(2);
  });
});

describe("in-browser search", () => {
  const posts = [
    { title: "Funny cats", text: "", category: "comedy", createdAt: 1 },
    { title: "Music", text: "cats singing", category: "music", createdAt: 2 },
    { title: "Café Kampala", text: "", category: "food", createdAt: 3 },
  ];
  it("ranks title matches first", () => expect(searchPosts(posts, "cats").map((p) => p.title)).toEqual(["Funny cats", "Music"]));
  it("ignores accents and case", () => expect(searchPosts(posts, "CAFE")).toHaveLength(1));
  it("every word must match", () => expect(searchPosts(posts, "cats food")).toHaveLength(0));
});

import { chunkStmts, flushDelay } from "@/lib/stat-buffer";
describe("scale controls", () => {
  it("quiet instance saves every 3s", () => expect(flushDelay(10)).toBe(3_000));
  it("busy instance waits 10s", () => expect(flushDelay(500)).toBe(10_000));
  it("viral instance waits 30s at most before jitter", () => expect(flushDelay(100_000)).toBe(30_000));
  it("jitter adds at most 30%", () => expect(flushDelay(10, 1)).toBe(3_900));
  it("splits 1201 statements into 500/500/201", () => expect(chunkStmts(Array(1201).fill(0)).map((c) => c.length)).toEqual([500, 500, 201]));
});
