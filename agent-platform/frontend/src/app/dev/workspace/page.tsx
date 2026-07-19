"use client";
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { WorkspaceAgent, WorkspaceType } from "@/components/world/WorkspaceRoom.types";
import type { ApeStatus } from "@/components/world/ApeAgent.types";

const Scene = dynamic(() => import("@/components/world/WorkspacePreviewScene").then((m) => m.WorkspacePreviewScene), { ssr: false });

const TYPES: WorkspaceType[] = ["operations", "research", "creative", "sales", "command"];
const STATUSES: (ApeStatus | "mixed")[] = ["mixed", "idle", "working", "thinking", "waiting", "completed", "error"];
const ROLES = ["Operator", "Researcher", "Writer", "Closer", "Analyst", "Planner", "Scout", "Editor", "Auditor", "Broker", "Curator", "Chief"];

export default function WorkspaceDevPage() {
  const [type, setType] = useState<WorkspaceType>("operations");
  const [count, setCount] = useState(1);
  const [status, setStatus] = useState<ApeStatus | "mixed">("working");
  const [quality, setQuality] = useState<"low" | "medium" | "high">("high");
  const [orbit, setOrbit] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const agents: WorkspaceAgent[] = useMemo(() => {
    const cycle: ApeStatus[] = ["working", "thinking", "idle", "waiting", "completed", "error"];
    return Array.from({ length: count }, (_, i) => ({
      id: `a${i + 1}`, name: ROLES[i % ROLES.length], role: `${type} agent`,
      status: status === "mixed" ? cycle[i % cycle.length] : status,
      workstationId: `ws-${i + 1}`, progress: 0.4 + (i % 5) * 0.12,
    }));
  }, [count, status, type]);

  const shot = () => {
    const c = document.querySelector("canvas"); if (!c) return;
    const a = document.createElement("a"); a.href = c.toDataURL("image/png"); a.download = "ape-workspace.png"; a.click();
  };

  return (
    <div style={{ minHeight: "100vh", background: "#e7e0d4", color: "#1c1a17", fontFamily: "ui-sans-serif, system-ui, sans-serif", display: "flex", flexDirection: "column" }}>
      <header style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", padding: "10px 14px", borderBottom: "1px solid #d8cfc0", background: "#efe9df" }}>
        <strong style={{ fontSize: 14, marginRight: 6 }}>Workspace · /dev/workspace</strong>
        <Sel label="Room" value={type} options={TYPES} onChange={(v) => setType(v as WorkspaceType)} />
        <label style={{ fontSize: 13, display: "inline-flex", gap: 6, alignItems: "center" }}>
          <span style={{ color: "#8a8072" }}>Agents</span>
          <input type="range" min={1} max={5} value={count} onChange={(e) => { setCount(+e.target.value); setSelected(null); }} />
          <b style={{ width: 18 }}>{count}</b>
        </label>
        <Sel label="Status" value={status} options={STATUSES} onChange={(v) => setStatus(v as ApeStatus)} />
        <Sel label="Quality" value={quality} options={["low", "medium", "high"]} onChange={(v) => setQuality(v as "high")} />
        <Btn on={orbit} onClick={() => setOrbit((v) => !v)}>Orbit</Btn>
        <Btn on={mobile} onClick={() => setMobile((v) => !v)}>{mobile ? "Mobile" : "Desktop"}</Btn>
        <button onClick={() => setSelected(null)} style={btn(false)}>Reset camera</button>
        <button onClick={shot} style={btn(false)}>Screenshot</button>
        {selected && <span style={{ fontSize: 12, color: "#8a8072" }}>focused: {selected}</span>}
      </header>

      <main style={{ flex: 1, display: "grid", placeItems: "center", padding: 10 }}>
        <div style={{ width: mobile ? 390 : "100%", height: mobile ? 760 : "100%", maxWidth: 1280, minHeight: 520,
          border: mobile ? "1px solid #d8cfc0" : "none", borderRadius: mobile ? 26 : 0, overflow: "hidden" }}>
          <Scene type={type} agents={agents} selectedAgentId={selected} quality={quality} orbit={orbit}
            onAgentClick={(id) => setSelected((s) => (s === id ? null : id))}
            onCreateAgent={() => setCount((c) => Math.min(5, c + 1))} />
        </div>
      </main>
    </div>
  );
}

function btn(on: boolean): React.CSSProperties {
  return { fontSize: 13, fontWeight: 600, padding: "6px 11px", borderRadius: 9, border: "1px solid " + (on ? "#F47C20" : "#d8cfc0"), background: on ? "#FDEBDC" : "#fff", color: on ? "#B85712" : "#333", cursor: "pointer" };
}
function Btn({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} style={btn(on)}>{children}</button>;
}
function Sel({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <label style={{ fontSize: 13, display: "inline-flex", gap: 6, alignItems: "center" }}>
      <span style={{ color: "#8a8072" }}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ fontSize: 13, padding: "5px 8px", borderRadius: 8, border: "1px solid #d8cfc0", background: "#fff", textTransform: "capitalize" }}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
