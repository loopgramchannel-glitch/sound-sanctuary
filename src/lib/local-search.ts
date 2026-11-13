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
