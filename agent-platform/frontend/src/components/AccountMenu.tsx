"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getWorkspace, getApiKey, clearApiKey } from "@/lib/auth";

/** Workspace chip + sign-out. Renders nothing until a key is present (keeps the
 *  frictionless demo clean; appears once a real workspace is signed in). */
export function AccountMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [workspace, setWorkspace] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAuthed(!!getApiKey());
    setWorkspace(getWorkspace());
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  if (!authed) return null;
  const label = workspace || "Workspace";
  const initial = label.trim().charAt(0).toUpperCase() || "W";

  function signOut() {
    clearApiKey();
    router.push("/login?mode=signin");
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 items-center gap-2 rounded-xl border border-line bg-surface px-2.5 text-sm text-content-muted transition-colors hover:text-content"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span
          className="grid h-6 w-6 place-items-center rounded-lg text-xs font-bold text-white"
          style={{ background: "linear-gradient(135deg,#F0BE4D 0%,#ED7150 92%)" }}
        >
          {initial}
        </span>
        <span className="hidden max-w-[10rem] truncate font-medium text-content sm:inline">{label}</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-11 z-50 w-56 overflow-hidden rounded-xl border border-line bg-surface-overlay shadow-raised"
        >
          <div className="border-b border-line px-3.5 py-3">
            <p className="text-2xs uppercase tracking-wide text-content-subtle">Signed in to</p>
            <p className="truncate text-sm font-semibold text-content">{label}</p>
          </div>
          <button
            onClick={signOut}
            role="menuitem"
            className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm text-content-muted transition-colors hover:bg-content/5 hover:text-content"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></svg>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
