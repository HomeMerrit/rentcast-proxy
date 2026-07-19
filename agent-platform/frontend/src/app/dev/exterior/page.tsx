"use client";
import dynamic from "next/dynamic";

const ApeworksExteriorScene = dynamic(
  () => import("@/components/world/ApeworksExteriorScene").then((m) => m.ApeworksExteriorScene),
  { ssr: false },
);

export default function ExteriorPage() {
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#2C3550",
      fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif" }}>
      <header style={{ display: "flex", gap: 10, alignItems: "baseline", padding: "10px 16px",
        color: "#EDE8E0", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <strong style={{ fontSize: 15 }}>APE AGENTS HQ · exterior · /dev/exterior</strong>
        <span style={{ color: "#8b93ad", fontSize: 13 }}>loads /models/apeworks-exterior.glb — drag to orbit</span>
      </header>
      <main style={{ flex: 1, minHeight: 0 }}>
        <ApeworksExteriorScene />
      </main>
    </div>
  );
}
