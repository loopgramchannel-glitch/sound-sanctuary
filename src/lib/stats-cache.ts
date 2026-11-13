// Shared rules for the edge-cached stats endpoint.
export const STATS_CACHE = "public, max-age=10, s-maxage=30, stale-while-revalidate=120, stale-if-error=86400";
const ID = /^[a-z0-9-]{3,64}$/;

/** Sorted, unique, max 100 ids — sorting makes identical lists share one CDN cache entry. */
export function parseStatIds(raw: string | null): string[] | null {
  if (!raw) return null;
  const ids = [...new Set(raw.split(","))].sort();
  if (!ids.length || ids.length > 100 || !ids.every((i) => ID.test(i))) return null;
  return ids;
}
