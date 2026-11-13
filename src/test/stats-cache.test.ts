import { describe, expect, it } from "vitest";
import { parseStatIds, STATS_CACHE } from "../lib/stats-cache";

describe("stats edge cache", () => {
  it("caches counts at the edge for 30s", () => {
    expect(STATS_CACHE).toContain("s-maxage=30");
  });
  it("sorts and dedupes ids so lists share one cache entry", () => {
    expect(parseStatIds("b-1,a-1,b-1")).toEqual(["a-1", "b-1"]);
  });
  it("rejects more than 100 ids or bad ids", () => {
    expect(parseStatIds(Array.from({ length: 101 }, (_, i) => `p-${i}`).join(","))).toBeNull();
    expect(parseStatIds("bad id!")).toBeNull();
  });
});
