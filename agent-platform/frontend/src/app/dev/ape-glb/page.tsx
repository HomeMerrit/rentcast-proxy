"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import type { ApeView } from "@/components/world/ApeGlbScene";

const ApeGlbScene = dynamic(
  () => import("@/components/world/ApeGlbScene").then((m) => m.ApeGlbScene),
  { ssr: false },
);

const VIEWS: { key: ApeView; label: string }[] = [
  { key: "front", label: "Front" },
  { key: "three-quarter", label: "3/4" },
  { key: "side", label: "Side" },
];

export default function ApeGlbPage() {
  const [view, setView] = useState<ApeView>("three-quarter");
  const [overlay, setOverlay] = useState(false);

  return (
    <div style={{ minHeight: "100vh", background: "#fff", color: "#141414",
      fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif", display: "flex", flexDirection: "column" }}>
      <header style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #eee" }}>
        <strong style={{ fontSize: 15, marginRight: 8 }}>ApeAgent GLB · /dev/ape-glb</strong>
        <span style={{ color: "#888", fontSize: 13 }}>loads /models/ape-agent-master.glb</span>
        <span style={{ width: 12 }} />
        {VIEWS.map((v) => <Btn key={v.key} on={view === v.key} onClick={() => setView(v.key)}>{v.label}</Btn>)}
        <Btn on={overlay} onClick={() => setOverlay((v) => !v)}>Overlay 50%</Btn>
      </header>

      <main style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "#eee", minHeight: 520 }}>
        <div style={{ position: "relative", background: "#fff", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0 }}>
            <ApeGlbScene view={view} />
          </div>
          {overlay && (
            <img src="/ape-reference.png" alt="overlay"
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", opacity: 0.5, pointerEvents: "none" }} />
          )}
          <Tag>GLB MASTER</Tag>
        </div>
        <div style={{ position: "relative", background: "#fff", display: "grid", placeItems: "center", overflow: "hidden" }}>
          <img src="/ape-reference.png" alt="reference" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          <Tag>REFERENCE</Tag>
        </div>
      </main>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span style={{ position: "absolute", top: 10, left: 10, fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
    color: "#999", background: "rgba(255,255,255,0.8)", padding: "3px 7px", borderRadius: 6 }}>{children}</span>;
}
function Btn({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} style={{ fontSize: 13, fontWeight: 600, padding: "6px 11px", borderRadius: 9,
    border: "1px solid " + (on ? "#F58220" : "#ddd"), background: on ? "#FDEBDC" : "#fff", color: on ? "#B85712" : "#333", cursor: "pointer" }}>{children}</button>;
}
