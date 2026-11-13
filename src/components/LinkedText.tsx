import { Fragment } from "react";

/** Split a link from trailing sentence punctuation: "https://x.com/a." → ["https://x.com/a", "."]. */
export function splitTrailing(url: string): [string, string] {
  const m = url.match(/[.,!?;:)\]'"]+$/);
  return m ? [url.slice(0, -m[0].length), m[0]] : [url, ""];
}

/** Description text with https:// links made clickable. */
export function LinkedText({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (!/^https?:\/\//.test(p)) return <Fragment key={i}>{p}</Fragment>;
        const [raw, tail] = splitTrailing(p);
        const href = raw.replace(/^http:\/\//i, "https://");
        return <Fragment key={i}><a href={href} target="_blank" rel="noopener noreferrer nofollow" onClick={(e) => e.stopPropagation()} className="text-primary underline break-all">{href}</a>{tail}</Fragment>;
      })}
    </>
  );
}
