import { describe, it, expect } from "vitest";
import { parseJob, jobKey } from "./jobs";

describe("pushpage jobs", () => {
  const j = { v: 1, kind: "pushpage", bid: "abcdef12-3456", after: "https://x/1", title: "t", body: "b", url: "/post/1" };
  it("accepts a valid page job", () => expect(parseJob(JSON.stringify(j))?.kind).toBe("pushpage"));
  it("rejects external urls", () => expect(parseJob(JSON.stringify({ ...j, url: "https://evil" }))).toBeNull());
  it("each page has its own key", () => expect(jobKey(j as never)).toBe("pushpage:abcdef12-3456:https://x/1"));
});
