import { describe, expect, it } from "vitest";
import { mixFeed } from "@/lib/feed-mix";

const mk = (g: string, n: number, pinned = false) => Array.from({ length: n }, (_, i) => ({ id: `${g}${i}`, g, pinned, createdAt: i, category: "" }));

describe("for you mix", () => {
  it("never shows the same creator twice in a row when others exist", () => {
    const out = mixFeed([...mk("a", 20), ...mk("b", 20), ...mk("c", 20)], 7, (p) => p.g);
    for (let i = 1; i < out.length; i++) expect(out[i]!.g).not.toBe(out[i - 1]!.g);
  });
  it("keeps pinned posts first and loses nothing", () => {
    const out = mixFeed([...mk("a", 5), ...mk("p", 1, true)], 3, (p) => p.g);
    expect(out[0]!.id).toBe("p0");
    expect(out).toHaveLength(6);
  });
  it("same seed gives the same order", () => {
    const l = [...mk("a", 10), ...mk("b", 10)];
    expect(mixFeed(l, 5, (p) => p.g).map((p) => p.id)).toEqual(mixFeed(l, 5, (p) => p.g).map((p) => p.id));
  });
});
