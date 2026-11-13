import { describe, expect, it } from "vitest";
import { FEED_BATCH, nextCount } from "@/lib/infinite";

describe("feed batches", () => {
  it("shows 16 at a time", () => expect(FEED_BATCH).toBe(16));
  it("adds one batch", () => expect(nextCount(16, 1_000_000)).toBe(32));
  it("never passes the total", () => expect(nextCount(16, 20)).toBe(20));
});
