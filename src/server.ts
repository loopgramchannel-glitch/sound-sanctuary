import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

// Public pages that are identical for every visitor: shared edge cache absorbs traffic spikes.
const EDGE_CACHE: [RegExp, string][] = [
  [/^\/$/, "public, max-age=0, s-maxage=30, stale-while-revalidate=300, stale-if-error=86400"],
  [/^\/(explore|search)$/, "public, max-age=0, s-maxage=60, stale-while-revalidate=300, stale-if-error=86400"],
  [/^\/post\/[a-z0-9-]{3,64}$/, "public, max-age=0, s-maxage=60, stale-while-revalidate=600, stale-if-error=86400"],
];
const IMMUTABLE = /^\/assets\/.+\.[a-f0-9]{6,}\.|^\/assets\//;

export function cachePolicy(req: Request, res: Response): string | null {
  if (req.method !== "GET" || res.status !== 200) return null;
  if (res.headers.has("cache-control") || res.headers.has("set-cookie")) return null;
  if (req.headers.get("authorization")) return null;
  const url = new URL(req.url);
  if (IMMUTABLE.test(url.pathname)) return "public, max-age=31536000, immutable";
  if (url.pathname.startsWith("/_serverFn") || url.pathname.startsWith("/api/")) return null;
  if (!(res.headers.get("content-type") ?? "").includes("text/html")) return null;
  for (const [re, v] of EDGE_CACHE) if (re.test(url.pathname)) return v;
  return null;
}

function withCache(req: Request, res: Response): Response {
  const v = cachePolicy(req, res);
  if (!v) return res;
  const out = new Response(res.body, res);
  out.headers.set("cache-control", v);
  return out;
}

// Firebase sign-in pages served from our own domain (see auth-domain.ts).
async function proxyFirebaseAuth(request: Request, env: unknown): Promise<Response> {
  const e = env as Record<string, string | undefined> | undefined;
  const target = (e?.["FIREBASE_AUTH_DOMAIN"] ?? process.env["FIREBASE_AUTH_DOMAIN"] ?? "").trim();
  if (!target) return new Response("Not found", { status: 404 });
  const url = new URL(request.url);
  const headers = new Headers(request.headers);
  headers.delete("host"); headers.delete("cookie");
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  return fetch(`https://${target}${url.pathname}${url.search}`, {
    method: request.method, headers, body: hasBody ? request.body : null, redirect: "manual",
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const { isFirebaseAuthPath } = await import("./lib/auth-domain");
      if (isFirebaseAuthPath(new URL(request.url).pathname)) return await proxyFirebaseAuth(request, env);
      const db = (env as { DB?: unknown } | undefined)?.DB;
      if (db) { const { setNativeD1 } = await import("./lib/backend.server"); setNativeD1(db); }
      const handler = await getServerEntry();
      const response = withCache(request, await handler.fetch(request, env, ctx));
      // Background import + queue drain after the response (never blocks the visitor).
      const wait = (ctx as { waitUntil?: (p: Promise<unknown>) => void } | undefined)?.waitUntil;
      if (wait) {
        wait.call(ctx, import("./lib/heartbeat.server").then((m) => m.heartbeat()).catch(() => {}));
        // Write buffered views/likes to D1 when due (no-op when nothing is waiting).
        wait.call(ctx, import("./lib/post-stats.server").then((m) => m.flushStats()).catch(() => {}));
      }
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
