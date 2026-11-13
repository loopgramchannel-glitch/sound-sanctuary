// YouTube-style lock: guests can't like/dislike; tapping opens a "Sign in" prompt.
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { canVote } from "@/lib/like-lock";

export function useLikeLock(postId: string, tap: (v: 1 | -1) => void) {
  const auth = useAuth();
  const [ask, setAsk] = useState<null | 1 | -1>(null);
  const vote = (v: 1 | -1) => { if (canVote(auth.ready, auth.user)) tap(v); else setAsk(v); };
  const prompt = (
    <Dialog open={ask !== null} onOpenChange={(o) => { if (!o) setAsk(null); }}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>{ask === -1 ? "Don't like this video?" : "Like this video?"}</DialogTitle>
          <DialogDescription>Sign in to make your opinion count.</DialogDescription>
        </DialogHeader>
        <div className="mt-2 flex justify-end gap-2">
          <button onClick={() => setAsk(null)} className="rounded-full px-4 py-2 text-sm font-medium hover:bg-accent">Cancel</button>
          <Link to="/login" search={{ redirect: `/post/${postId}` }} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Sign in</Link>
        </div>
      </DialogContent>
    </Dialog>
  );
  return { vote, prompt };
}
