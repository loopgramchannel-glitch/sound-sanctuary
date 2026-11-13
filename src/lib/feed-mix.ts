// "For You" mix: seeded shuffle across all posts, then no two neighbours from the same group
// (same creator, or same import batch when the creator is unknown). Pinned posts stay on top.
import type { PostT } from "./posts";

const BATCH_MS = 30 * 60 * 1000;

/** Which "creator" a post belongs to: imports from one account land in the same time batch. */
export function mixGroup(p: Pick<PostT, "createdAt" | "category">): string {
  return `b${Math.floor(p.createdAt / BATCH_MS)}`;
}

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

/** Same seed → same order on server and browser (no flicker); the seed changes every hour. */
export function hourSeed(now = Date.now()) { return Math.floor(now / 3_600_000); }

export function mixFeed<T extends Pick<PostT, "pinned" | "createdAt" | "category">>(list: T[], seed: number, group: (p: T) => string = mixGroup): T[] {
  const pinned = list.filter((p) => p.pinned);
  const rest = list.filter((p) => !p.pinned);
  const r = rng(seed);
  for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [rest[i], rest[j]] = [rest[j]!, rest[i]!]; }
  for (let i = 1; i < rest.length; i++) {
    if (group(rest[i]!) !== group(rest[i - 1]!)) continue;
    const j = rest.findIndex((p, k) => k > i && group(p) !== group(rest[i - 1]!));
    if (j > 0) [rest[i], rest[j]] = [rest[j]!, rest[i]!];
  }
  return [...pinned, ...rest];
}
