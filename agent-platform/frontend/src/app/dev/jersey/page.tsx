"use client";
import dynamic from "next/dynamic";
import type { ApePattern, ApeAccessory } from "@/components/world/ApeAgentModel";

const ApeTurntable = dynamic(
  () => import("@/components/world/ApeTurntable").then((m) => m.ApeTurntable),
  { ssr: false },
);

/** Kit pattern lineup for approval — one ape per pattern trait, each in a
 *  different accent, all spinning. */
const LINEUP: { pattern: ApePattern; accent: string; number: number; label: string; accessories?: ApeAccessory[] }[] = [
  { pattern: "bolt", accent: "#5A97D6", number: 9, label: "OPS" },
  { pattern: "stripes", accent: "#E06A9A", number: 23, label: "CRE" },
  { pattern: "hoops", accent: "#6BB47C", number: 4, label: "SAL", accessories: ["headset"] },
  { pattern: "chevron", accent: "#E6AE3C", number: 71, label: "CMD", accessories: ["crown"] },
  { pattern: "sash", accent: "#8B79D4", number: 47, label: "RES" },
  { pattern: "dots", accent: "#4FB0AA", number: 12, label: "OPS" },
];

export default function JerseyPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#F3EDE2", padding: 20,
      fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif" }}>
      <header style={{ display: "flex", gap: 10, alignItems: "baseline", marginBottom: 14 }}>
        <strong style={{ fontSize: 15, color: "#1E1B18" }}>Kit patterns · /dev/jersey</strong>
        <span style={{ color: "#8a8377", fontSize: 13 }}>one ape per pattern trait, accent-tonal shades</span>
      </header>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, maxWidth: 1080 }}>
        {LINEUP.map((k) => (
          <div key={k.pattern} style={{ position: "relative", background: "#FBF7EF", borderRadius: 18,
            border: "1px solid #E5DCCB", overflow: "hidden", height: 300 }}>
            <ApeTurntable
              status="idle"
              accent={k.accent}
              pattern={k.pattern}
              jersey={{ number: k.number, label: k.label }}
              accessories={k.accessories ?? null}
              className="pattern-cell"
            />
            <span style={{ position: "absolute", top: 10, left: 12, fontSize: 12, fontWeight: 700,
              letterSpacing: 0.5, color: "#8a8377", textTransform: "uppercase" }}>{k.pattern}</span>
          </div>
        ))}
      </div>
      <style>{`.pattern-cell { position: absolute; inset: 0; }`}</style>
    </div>
  );
}
