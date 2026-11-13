import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Public: checks a Cloudflare Turnstile token before the browser signs in, signs up or asks for a reset link. */
export const verifyHuman = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(1).max(2048) }).parse(d))
  .handler(async ({ data }) => {
    const { verifyTurnstile } = await import("./turnstile.server");
    const r = await verifyTurnstile(data.token);
    // If Turnstile isn't configured on this host, don't lock everyone out.
    if (!r.ok && r.reason === "not-configured") return { ok: true as const };
    return r;
  });
