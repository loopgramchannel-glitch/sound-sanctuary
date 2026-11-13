// Where search ads go: after `after` results, then again every `every` results (0 = once).
export function searchAdAfter(i: number, after = 2, every = 0): boolean {
  const n = i + 1;
  if (n < after) return false;
  if (n === after) return true;
  return every > 0 && (n - after) % every === 0;
}
