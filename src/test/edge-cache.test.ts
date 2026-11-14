import { describe, expect, it } from "vitest";
import { cachePolicy } from "../server";

const html = (h: Record<string, string> = {}) => new Response("x", { status: 200, headers: { "content-type": "text/html", ...h } });
const get = (p: string, h: Record<string, string> = {}) => new Request(`http://x${p}`, { headers: h });

describe("edge cache policy", () => {
  it("caches the home feed at the edge for 30s", () => {
    expect(cachePolicy(get("/"), html())).toContain("s-maxage=60");
  });
  it("caches watch pages at the edge for 60s", () => {
    expect(cachePolicy(get("/post/p-abc123"), html())).toContain("s-maxage=300");
  });
  it("never caches studio or login", () => {
    expect(cachePolicy(get("/studio"), html())).toBeNull();
    expect(cachePolicy(get("/login"), html())).toBeNull();
  });
  it("never caches signed-in or cookie-setting responses", () => {
    expect(cachePolicy(get("/", { authorization: "Bearer t" }), html())).toBeNull();
    expect(cachePolicy(get("/"), html({ "set-cookie": "a=b" }))).toBeNull();
  });
  it("never caches errors", () => {
    expect(cachePolicy(get("/"), new Response("x", { status: 500, headers: { "content-type": "text/html" } }))).toBeNull();
  });
  it("marks built assets immutable", () => {
    expect(cachePolicy(get("/assets/app.abc123.js"), new Response("x"))).toContain("immutable");
  });
});

import { describe as d2, it as i2, expect as e2 } from "vitest";
import { cachePolicy as cp } from "../server";
d2("shorts edge cache", () => {
  i2("caches /shorts at the edge and serves stale for a day", () => {
    const v = cp(new Request("https://x.com/shorts"), new Response("ok", { headers: { "content-type": "text/html" } }));
    e2(v).toContain("s-maxage=60");
    e2(v).toContain("stale-while-revalidate=86400");
  });
});
