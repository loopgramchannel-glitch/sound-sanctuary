import { expect, test } from "vitest";
import { searchPosts, searchSuggestions } from "@/lib/local-search";
const mk = (title: string) => ({ title, text: "", category: "" });
const posts = [mk("Funny day #williamlast_krm"), mk("Hero time #williamlast_krm"), mk("Other")];
test("suggestions are short keywords, and picking one finds every match", () => {
  const s = searchSuggestions(posts, "william");
  expect(s[0]).toBe("#williamlast_krm");
  expect(searchPosts(posts, s[0] ?? "").length).toBe(2);
});
