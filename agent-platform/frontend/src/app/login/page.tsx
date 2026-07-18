"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { setApiKey } from "@/lib/auth";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      const res = await fetch(`${base}/auth/keys`, {
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Invalid API key");
      setApiKey(key);
      const from = searchParams.get("from") ?? "/";
      router.push(from);
    } catch {
      setError("Invalid API key. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        type="password"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        placeholder="ak_..."
        className="w-full bg-surface-inset border border-line-strong rounded-lg px-4 py-2.5 text-content placeholder-content-subtle focus:outline-none focus:border-iris-400"
      />
      {error && <p className="text-danger text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading || !key}
        className="w-full bg-iris-500 hover:bg-iris-600 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors"
      >
        {loading ? "Verifying..." : "Sign in"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas">
      <div className="bg-surface border border-line rounded-xl p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-content mb-2">AgentOS</h1>
        <p className="text-content-muted mb-6 text-sm">Enter your API key to continue</p>
        <Suspense fallback={<div className="text-content-subtle text-sm">Loading...</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
