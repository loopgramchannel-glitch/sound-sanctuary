import { notify } from "@/lib/notify";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Eye, EyeOff, Loader2, MailCheck } from "lucide-react";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { authErrorMessage, backoffMs, destinationFor, validateCredentials } from "@/lib/auth";
import { verifyHuman } from "@/lib/human.functions";
import { Turnstile } from "@/components/Turnstile";

export const Route = createFileRoute("/login")({
  validateSearch: z.object({ redirect: z.string().max(500).optional() }),
  head: () => ({
    meta: [
      { title: "Log in or sign up — LoopgramChannel" },
      { name: "description", content: "Log in or create your LoopgramChannel account with email and password." },
      { property: "og:title", content: "Log in or sign up — LoopgramChannel" },
      { property: "og:description", content: "Log in or create your LoopgramChannel account with email and password." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LoginPage,
});

// ChatGPT-style flow: email first → password (sign in or create) → reset / email sent.
type Step = "email" | "signin" | "signup" | "reset" | "sent";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const HAS_TURNSTILE = !!import.meta.env["VITE_TURNSTILE_SITE_KEY"];
// Robot check is always enforced on the live site; preview/dev hosts Cloudflare refuses may skip it.
const isLiveHost = () => typeof window !== "undefined" && /(^|\.)loopgramchannel\.com$/.test(window.location.hostname);


const inputCls = "h-12 w-full rounded-full border bg-background px-5 text-base outline-none focus:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";
const primaryCls = "inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60";

function LoginPage() {
  const { redirect } = Route.useSearch();
  const auth = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState<null | "form">(null);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [tsSkip, setTsSkip] = useState(false);
  const failures = useRef(0);
  const [waitUntil, setWaitUntil] = useState(0);

  useEffect(() => {
    if (auth.ready && auth.user && auth.role) nav({ to: destinationFor(auth.role, redirect), replace: true });
  }, [auth.ready, auth.user, auth.role]);

  function go(s: Step) { setStep(s); setError(null); setPassword(""); }

  async function humanCheck() {
    if (!HAS_TURNSTILE || tsSkip) return;
    if (!token) throw { code: "human-check" };
    const r = await verifyHuman({ data: { token } });
    setResetKey((k) => k + 1); // tokens are single-use
    if (!r.ok) throw { code: "human-check" };
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (step === "email") {
      if (!EMAIL_RE.test(email.trim())) { setError("Enter a valid email address."); return; }
      go("signin"); return;
    }
    if (Date.now() < waitUntil) { setError(`Please wait ${Math.ceil((waitUntil - Date.now()) / 1000)}s before trying again.`); return; }
    setBusy("form");
    try {
      await humanCheck();
      if (step === "reset") {
        await auth.resetPassword(email);
        notify({ kind: "account", title: "Password reset link sent", body: `Check ${email.trim()} and your spam folder.` });
        setStep("sent"); return;
      }
      const v = validateCredentials(email, password);
      if (v) { setError(v); return; }
      const role = step === "signup" ? await auth.signUp(email, password) : await auth.signIn(email, password);
      failures.current = 0; setPassword("");
      nav({ to: destinationFor(role, redirect), replace: true });
    } catch (err: any) {
      if (err?.code !== "human-check") {
        failures.current++;
        const wait = backoffMs(failures.current);
        if (wait) setWaitUntil(Date.now() + wait);
      }
      setError(authErrorMessage(err?.code));
    } finally { setBusy(null); }
  }

  const title = { email: "Welcome to Loopgram", signin: "Enter your password", signup: "Create a password", reset: "Reset password", sent: "Check your email" }[step];
  const sub = {
    email: "Sign in to like, comment and never miss a new video.",
    signin: "Welcome back! Enter your password to continue.",
    signup: "Set a password to create your account.",
    reset: "We'll email you a link to choose a new password.",
    sent: `If an account exists for ${email.trim()}, a reset link is on its way. Check your spam folder too.`,
  }[step];

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-3xl border bg-card p-6 shadow-xl sm:p-8">
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          {step === "sent" ? <MailCheck className="h-10 w-10 text-primary" /> : <img src="/icon.svg" alt="" className="h-14 w-14 rounded-2xl bg-secondary p-2" />}
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
          <p className="text-sm text-muted-foreground">{sub}</p>
        </div>

        {step === "sent" ? (
          <button type="button" onClick={() => go("signin")} className={primaryCls}>Back to log in</button>
        ) : (
          <form onSubmit={submit} noValidate className="space-y-3" aria-busy={!!busy}>
            {step === "email" ? (
              <input id="email" type="email" aria-label="Email address" placeholder="Email address" autoComplete="email" inputMode="email" autoFocus
                value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
            ) : (
              <div className="flex h-12 items-center justify-between rounded-full border bg-secondary/50 px-5 text-sm">
                <span className="truncate">{email.trim()}</span>
                <button type="button" onClick={() => go("email")} className="ml-3 shrink-0 font-semibold text-primary hover:underline">Edit</button>
              </div>
            )}

            {(step === "signin" || step === "signup") && (
              <div className="relative">
                <input id="password" type={show ? "text" : "password"} aria-label="Password" placeholder="Password" autoFocus
                  autoComplete={step === "signup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)}
                  className={`${inputCls} pr-12`} />
                <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} aria-pressed={show}
                  className="absolute right-2 top-1.5 inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:text-foreground">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            )}
            {step === "signin" && (
              <button type="button" onClick={() => go("reset")} className="px-2 text-sm font-medium text-primary hover:underline">Forgot password?</button>
            )}

            {step !== "email" && <Turnstile onToken={(t) => { setToken(t); if (t) setError(null); }} resetKey={resetKey}
              onError={(c) => { if (c.startsWith("1102") && !isLiveHost()) { setTsSkip(true); return; } setError(c.startsWith("1102") ? "Robot check isn't set up for this web address yet. Add it in Cloudflare Turnstile → Hostnames." : "Robot check couldn't load. Refresh the page and try again."); }} />}

            {error && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</p>}

            <button type="submit" disabled={!!busy || !auth.ready || (step !== "email" && HAS_TURNSTILE && !tsSkip && !token)} className={primaryCls}>
              {busy === "form" && <Loader2 className="h-4 w-4 animate-spin" />}
              {step === "email" ? "Continue" : step === "signin" ? "Log in" : step === "signup" ? "Create account" : "Send reset link"}
            </button>

            {step === "signin" && <p className="text-center text-sm text-muted-foreground">New here? <button type="button" onClick={() => go("signup")} className="font-semibold text-primary hover:underline">Create an account</button></p>}
            {step === "signup" && <p className="text-center text-sm text-muted-foreground">Already have an account? <button type="button" onClick={() => go("signin")} className="font-semibold text-primary hover:underline">Log in</button></p>}
            {step === "reset" && <button type="button" onClick={() => go("signin")} className="mx-auto flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back to log in</button>}
          </form>
        )}

        <p className="mt-8 text-center text-xs text-muted-foreground"><Link to="/" className="hover:underline">Continue without signing in</Link></p>
      </div>
    </div>
  );
}
