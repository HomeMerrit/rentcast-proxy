"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import type { ApeStatus } from "@/components/world/ApeAgent.types";

const ApePreviewScene = dynamic(
  () => import("@/components/world/ApePreviewScene").then((m) => m.ApePreviewScene),
  { ssr: false },
);

const STATUSES: ApeStatus[] = ["idle", "working", "thinking", "waiting", "completed", "error"];

export default function ApeDevPage() {
  const [status, setStatus] = useState<ApeStatus>("idle");
  const [selected, setSelected] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [paused, setPaused] = useState(false);
  const [debug, setDebug] = useState(false);
  const [showFps, setShowFps] = useState(false);
  const [mobile, setMobile] = useState(false);

  const shot = () => {
    const c = document.querySelector("canvas");
    if (!c) return;
    const a = document.createElement("a");
    a.href = c.toDataURL("image/png");
    a.download = "ape-agent.png";
    a.click();
  };

  return (
    <div style={{ minHeight: "100vh", background: "#ffffff", color: "#141414",
      fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif", display: "flex", flexDirection: "column" }}>
      <header style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #eee" }}>
        <strong style={{ fontSize: 15, marginRight: 8 }}>ApeAgent · /dev/ape</strong>
        <Seg label="Status" value={status} options={STATUSES} onChange={(v) => setStatus(v as ApeStatus)} />
        <Btn on={selected} onClick={() => setSelected((v) => !v)}>Selected</Btn>
        <Btn on={autoRotate} onClick={() => setAutoRotate((v) => !v)}>Rotate</Btn>
        <Btn on={paused} onClick={() => setPaused((v) => !v)}>{paused ? "Paused" : "Pause"}</Btn>
        <Btn on={debug} onClick={() => setDebug((v) => !v)}>Wireframe</Btn>
        <Btn on={showFps} onClick={() => setShowFps((v) => !v)}>FPS</Btn>
        <Btn on={mobile} onClick={() => setMobile((v) => !v)}>{mobile ? "Mobile" : "Desktop"}</Btn>
        <button onClick={shot} style={btn(false)}>Screenshot</button>
      </header>

      <main style={{ flex: 1, display: "grid", placeItems: "center", padding: 12 }}>
        <div style={{ width: mobile ? 390 : "100%", height: mobile ? 720 : "100%", maxWidth: 1100,
          minHeight: 480, border: mobile ? "1px solid #eee" : "none", borderRadius: mobile ? 28 : 0, overflow: "hidden" }}>
          <ApePreviewScene status={status} selected={selected} autoRotate={autoRotate}
            paused={paused} debug={debug} showFps={showFps} onSelect={() => setSelected((v) => !v)} />
        </div>
      </main>
    </div>
  );
}

function btn(on: boolean): React.CSSProperties {
  return { fontSize: 13, fontWeight: 600, padding: "6px 11px", borderRadius: 9,
    border: "1px solid " + (on ? "#F47C20" : "#ddd"), background: on ? "#FDEBDC" : "#fff",
    color: on ? "#B85712" : "#333", cursor: "pointer" };
}
function Btn({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} style={btn(on)}>{children}</button>;
}
function Seg({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
      <span style={{ color: "#888" }}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        style={{ fontSize: 13, padding: "5px 8px", borderRadius: 8, border: "1px solid #ddd", background: "#fff", textTransform: "capitalize" }}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
