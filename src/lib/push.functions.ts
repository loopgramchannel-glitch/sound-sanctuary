import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isPushEndpoint } from "./push-keys";

const Sub = z.object({ endpoint: z.string().max(1000).refine(isPushEndpoint), p256dh: z.string().min(80).max(120), auth: z.string().min(16).max(40) });

/** Public: a visitor's browser registers for device alerts. */
export const pushSubscribe = createServerFn({ method: "POST" }).inputValidator((d: unknown) => Sub.parse(d)).handler(async ({ data }) => {
  const { saveSub } = await import("./push.server");
  await saveSub(data);
  return { ok: true };
});
export const pushUnsubscribe = createServerFn({ method: "POST" }).inputValidator((d: unknown) => z.object({ endpoint: z.string().max(1000).refine(isPushEndpoint) }).parse(d)).handler(async ({ data }) => {
  const { removeSub } = await import("./push.server");
  await removeSub(data.endpoint);
  return { ok: true };
});
