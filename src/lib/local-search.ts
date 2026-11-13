// Search that runs entirely in the viewer's browser over the already-loaded post list.
// No search service is called, so searching costs nothing no matter how many people search.
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

type Searchable = { title: string; text: string; category: string; createdAt?: number };

/** Every word must appear. Title matches rank first, then category, then newest. */
export function searchPosts<T extends Searchable>(posts: T[], q: string): T[] {
  const words = norm(q).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const scored: { p: T; s: number }[] = [];
  for (const p of posts) {
    const title = norm(p.title), cat = norm(p.category), all = `${title} ${norm(p.text)} ${cat}`;
    if (!words.every((w) => all.includes(w))) continue;
    let s = 0;
    for (const w of words) { if (title.includes(w)) s += 3; if (cat.includes(w)) s += 1; }
    scored.push({ p, s });
  }
  return scored.sort((a, b) => b.s - a.s || (b.p.createdAt ?? 0) - (a.p.createdAt ?? 0)).map((x) => x.p);
}

/** Short keyword suggestions (categories, #tags, words) — never whole titles, so picking one finds every matching video. */
export function searchSuggestions<T extends Searchable>(posts: T[], typed: string, max = 8): string[] {
  const t = norm(typed.trim());
  if (!t) return [];
  const count = new Map<string, number>();
  const add = (s: string) => { const k = s.toLowerCase(); count.set(k, (count.get(k) ?? 0) + 1); };
  for (const p of posts) {
    if (p.category && norm(p.category).includes(t)) add(p.category);
    for (const w of new Set(`${p.title} ${p.text}`.split(/[\s,.!?:;()"“”]+/))) {
      const clean = w.replace(/^[@]+/, "").replace(/[^\p{L}\p{N}#_'’-]/gu, "");
      if (clean.length >= 2 && clean.length <= 40 && norm(clean).includes(t)) add(clean);
    }
  }
  return [...count.entries()]
    .sort((a, b) => Number(norm(b[0]).startsWith(t)) - Number(norm(a[0]).startsWith(t)) || b[1] - a[1])
    .slice(0, max).map(([k]) => k);
}
