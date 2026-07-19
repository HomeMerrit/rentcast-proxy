"use client";
import Link from "next/link";

/** The product has exactly four places, with exactly these names, everywhere:
 *  Company (the overview), Flow (how work moves), Floor (the live feed),
 *  HQ (the building). One vocabulary — never per-page synonyms. */
const PLACES = [
  { href: "/", label: "Company" },
  { href: "/network", label: "Flow" },
  { href: "/live", label: "Floor" },
  { href: "/hq", label: "HQ" },
] as const;

export function AppNav({ current }: { current: "/" | "/network" | "/live" | "/hq" }) {
  return (
    <nav className="hidden items-center gap-1 md:flex">
      {PLACES.map((p) =>
        p.href === current ? (
          <span key={p.href} className="rounded-lg bg-content/5 px-3 py-1.5 text-sm font-medium text-content">{p.label}</span>
        ) : (
          <Link key={p.href} href={p.href} className="rounded-lg px-3 py-1.5 text-sm text-content-muted transition-colors hover:bg-content/5 hover:text-content">
            {p.label}
          </Link>
        )
      )}
    </nav>
  );
}
