// YouTube-style progressive feed: show a small batch, add the next batch when the viewer nears the bottom.
import { useEffect, useRef, useState } from "react";

export const FEED_BATCH = 16;

/** Next visible count after one "load more" step, never past the total. */
export function nextCount(shown: number, total: number, batch = FEED_BATCH): number {
  return Math.min(total, shown + batch);
}

export function useReveal(total: number, resetKey: unknown, batch = FEED_BATCH) {
  const [shown, setShown] = useState(batch);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { setShown(batch); }, [resetKey, batch]);
  useEffect(() => {
    const el = ref.current;
    if (!el || shown >= total) return;
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) setShown((s) => nextCount(s, total, batch));
    }, { rootMargin: "800px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [shown, total, batch]);
  return { shown: Math.min(shown, total), more: shown < total, ref };
}
