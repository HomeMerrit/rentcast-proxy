"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { setApiKey } from "@/lib/auth";
import { api } from "@/lib/api";
import { Logo } from "@/components/brand/Logo";

type Mode = "create" | "signin";

function Field({
  label, ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-content-subtle">{label}</span>
      <input
        {...props}
        className="w-full rounded-xl border border-line bg-surface-inset px-4 py-2.5 text-content placeholder-content-subtle outline-none transition-colors focus:border-iris-500 focus:ring-2 focus:ring-iris-500/20"
      />
    </label>
  );
}

function AuthCard() {
  const router = useRouter();
  const params = useSearchParams();
  const from = params.get("from") ?? "/";
  const [mode, setMode] = useState<Mode>(params.get("mode") === "signin" ? "signin" : "create");

  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [issuedKey, setIssuedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await api.auth.signup({ org_name: orgName, email, name: name || undefined });
      setApiKey(res.key, res.org_name);
      setIssuedKey(res.key); // reveal once
    } catch (err) {
      setError(err instanceof Error && /409/.test(err.message)
        ? "An account with that email already exists. Try signing in."
        : "Couldn't create the workspace. Check your details and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignin(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    setApiKey(key);
    try {
      await api.auth.validate(); // guarded route → throws on a bad key
      router.push(from);
    } catch {
      setError("That key isn't valid. Copy it exactly, including the ak_ prefix.");
      setLoading(false);
    }
  }

  // One-time key reveal after a successful signup.
  if (issuedKey) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2 text-positive">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          <p className="font-semibold text-content">Workspace created</p>
        </div>
        <p className="text-sm text-content-muted">
          This is your API key. It’s shown only once, so save it somewhere safe. You can make more keys later in settings.
        </p>
        <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-inset px-3 py-2.5">
          <code className="flex-1 select-all break-all font-mono text-sm text-content">{issuedKey}</code>
          <button
            onClick={() => { navigator.clipboard?.writeText(issuedKey); setCopied(true); setTimeout(() => setCopied(false), 1600); }}
            className="shrink-0 rounded-lg bg-surface px-3 py-1.5 text-xs font-semibold text-content-muted ring-1 ring-line transition hover:text-content"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <button
          onClick={() => router.push("/onboarding")}
          className="w-full rounded-xl bg-iris-500 py-2.5 font-semibold text-white transition-colors hover:bg-iris-600"
        >
          Continue to setup →
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex rounded-xl bg-surface-inset p-1 text-sm font-medium">
        <button
          onClick={() => { setMode("create"); setError(""); }}
          className={`flex-1 rounded-lg py-2 transition ${mode === "create" ? "bg-surface text-content shadow-sm" : "text-content-muted hover:text-content"}`}
        >
          Create workspace
        </button>
        <button
          onClick={() => { setMode("signin"); setError(""); }}
          className={`flex-1 rounded-lg py-2 transition ${mode === "signin" ? "bg-surface text-content shadow-sm" : "text-content-muted hover:text-content"}`}
        >
          Sign in
        </button>
      </div>

      {mode === "create" ? (
        <form onSubmit={handleCreate} className="space-y-4">
          <Field label="Workspace name" placeholder="Acme Inc." value={orgName} onChange={(e) => setOrgName(e.target.value)} autoFocus required />
          <Field label="Work email" type="email" placeholder="you@acme.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Field label="Your name (optional)" placeholder="Jordan Rivera" value={name} onChange={(e) => setName(e.target.value)} />
          {error && <p className="text-sm text-danger">{error}</p>}
          <button type="submit" disabled={loading || !orgName || !email}
            className="w-full rounded-xl bg-iris-500 py-2.5 font-semibold text-white transition-colors hover:bg-iris-600 disabled:opacity-50">
            {loading ? "Creating…" : "Create workspace →"}
          </button>
          <p className="text-center text-xs text-content-subtle">Free pilot. No card required.</p>
        </form>
      ) : (
        <form onSubmit={handleSignin} className="space-y-4">
          <Field label="API key" type="password" placeholder="ak_…" value={key} onChange={(e) => setKey(e.target.value)} autoFocus required />
          {error && <p className="text-sm text-danger">{error}</p>}
          <button type="submit" disabled={loading || !key}
            className="w-full rounded-xl bg-iris-500 py-2.5 font-semibold text-white transition-colors hover:bg-iris-600 disabled:opacity-50">
            {loading ? "Verifying…" : "Sign in"}
          </button>
          <p className="text-center text-xs text-content-subtle">New here? <button type="button" onClick={() => { setMode("create"); setError(""); }} className="font-semibold text-iris-600 hover:underline">Create a workspace</button></p>
        </form>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-canvas">
      {/* warm ambient glow — living-world, not a dark cockpit */}
      <div aria-hidden className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(680px 340px at 82% -8%, rgba(240,190,77,.16), transparent 60%), radial-gradient(560px 300px at -6% 4%, rgba(237,113,80,.10), transparent 55%)" }} />
      <div className="relative flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center gap-3">
            <Logo className="[&>svg]:h-11 [&>svg]:w-11" showText={false} />
            <div>
              <p className="font-display text-lg font-semibold tracking-tight text-content">Ape<span className="text-iris-500">Agents</span></p>
              <p className="text-xs text-content-muted">Build a company that builds itself.</p>
            </div>
          </div>
          <div className="rounded-2xl border border-line bg-surface p-7 shadow-xl">
            <Suspense fallback={<div className="text-sm text-content-subtle">Loading…</div>}>
              <AuthCard />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
