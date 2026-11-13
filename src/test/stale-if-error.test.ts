import { describe, it, expect } from "vitest";
import { cachePolicy } from "@/server";

describe("edge cache survives outages", () => {
  for (const path of ["/", "/explore", "/search", "/post/p-abc123"]) {
    it(`${path} keeps serving cached page for 24h if the server errors`, () => {
      const v = cachePolicy(new Request("https://x.com" + path), new Response("ok", { headers: { "content-type": "text/html" } }));
      expect(v).toContain("stale-if-error=86400");
    });
  }
});
