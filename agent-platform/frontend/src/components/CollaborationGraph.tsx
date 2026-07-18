"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { NetworkGraph, NetworkNode } from "@/types/agent";
import { avatarHue, initialsOf } from "./AgentAvatar";

const W = 820;
const H = 620;
const CX = W / 2;
const CY = H / 2;
const R = 232;

const STATUS: Record<string, string> = {
  active: "#4E9E63",
  thinking: "#E6AE3C",
  error: "#E8705C",
  idle: "#877F6E",
  offline: "#877F6E",
};

export function CollaborationGraph({ graph }: { graph: NetworkGraph }) {
  const router = useRouter();
  const [hover, setHover] = useState<string | null>(null);

  const { nodes, positions, edges, maxCount, animated } = useMemo(() => {
    const sorted = [...graph.nodes].sort((a, b) =>
      a.department === b.department ? a.name.localeCompare(b.name) : a.department.localeCompare(b.department)
    );
    const n = sorted.length;
    const positions: Record<string, { x: number; y: number; angle: number }> = {};
    sorted.forEach((node, i) => {
      const angle = (i / Math.max(1, n)) * Math.PI * 2 - Math.PI / 2;
      positions[node.id] = { x: CX + R * Math.cos(angle), y: CY + R * Math.sin(angle), angle };
    });
    const ids = new Set(sorted.map((s) => s.id));
    const edges = graph.edges.filter((e) => ids.has(e.from) && ids.has(e.to) && e.from !== e.to);
    const maxCount = Math.max(1, ...edges.map((e) => e.count));
    // animate the most recent edges (staggered packets)
    const animated = [...edges]
      .sort((a, b) => (b.last_at || "").localeCompare(a.last_at || ""))
      .slice(0, 16);
    return { nodes: sorted, positions, edges, maxCount, animated };
  }, [graph]);

  const edgePath = (from: string, to: string) => {
    const a = positions[from];
    const b = positions[to];
    if (!a || !b) return "";
    // control point pulled toward center for an elegant inward bow
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const cx = mx + (CX - mx) * 0.55;
    const cy = my + (CY - my) * 0.55;
    return `M${a.x.toFixed(1)},${a.y.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`;
  };

  const neighbors = useMemo(() => {
    if (!hover) return null;
    const s = new Set<string>([hover]);
    edges.forEach((e) => {
      if (e.from === hover) s.add(e.to);
      if (e.to === hover) s.add(e.from);
    });
    return s;
  }, [hover, edges]);

  const isEdgeLit = (from: string, to: string) => hover && (from === hover || to === hover);
  const hoveredNode: NetworkNode | undefined = nodes.find((nn) => nn.id === hover);

  if (nodes.length === 0) {
    return (
      <div className="grid h-[440px] place-items-center text-sm text-content-subtle">
        No agents yet.
      </div>
    );
  }

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 620 }}>
        <defs>
          <radialGradient id="net-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(240,190,77,0.22)" />
            <stop offset="100%" stopColor="rgba(240,190,77,0)" />
          </radialGradient>
        </defs>

        {/* ambient core + ring */}
        <circle cx={CX} cy={CY} r={R + 40} fill="url(#net-core)" />
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={1} />

        {/* edges */}
        {edges.map((e, i) => {
          const lit = isEdgeLit(e.from, e.to);
          const dim = hover && !lit;
          const width = 1 + (e.count / maxCount) * 4;
          return (
            <path
              key={`${e.from}-${e.to}-${i}`}
              d={edgePath(e.from, e.to)}
              fill="none"
              stroke={lit ? "#EF8A68" : "#ED7150"}
              strokeWidth={lit ? width + 1 : width}
              strokeOpacity={dim ? 0.06 : lit ? 0.9 : 0.28}
              strokeLinecap="round"
            />
          );
        })}

        {/* animated message packets along recent edges */}
        {!hover && animated.map((e, i) => {
          const d = edgePath(e.from, e.to);
          if (!d) return null;
          return (
            <circle key={`pkt-${i}`} r={3} fill="#5A97D6" opacity={0.9}>
              <animateMotion dur={`${2.4 + (i % 5) * 0.4}s`} begin={`${(i % 8) * 0.35}s`} repeatCount="indefinite" path={d} />
            </circle>
          );
        })}

        {/* nodes */}
        {nodes.map((node) => {
          const p = positions[node.id];
          const r = 15 + Math.min(13, node.comm_count * 1.5);
          const dim = neighbors ? !neighbors.has(node.id) : false;
          const ring = STATUS[node.status] || STATUS.idle;
          const clip = `clip-${node.id}`;
          return (
            <g
              key={node.id}
              transform={`translate(${p.x},${p.y})`}
              opacity={dim ? 0.28 : 1}
              style={{ cursor: "pointer", transition: "opacity 200ms" }}
              onMouseEnter={() => setHover(node.id)}
              onMouseLeave={() => setHover(null)}
              onClick={() => router.push(`/agents/${node.id}`)}
            >
              <defs>
                <linearGradient id={clip} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor={avatarHue(node.avatar_seed || node.name)[0]} />
                  <stop offset="1" stopColor={avatarHue(node.avatar_seed || node.name)[1]} />
                </linearGradient>
              </defs>
              <circle r={r + 3} fill="#FFFFFF" stroke={ring} strokeWidth={2.4} />
              <circle r={r} fill={`url(#${clip})`} />
              <text y={r * 0.34} textAnchor="middle" fontSize={r * 0.8} fontWeight={700} fill="#fff" style={{ pointerEvents: "none" }}>
                {initialsOf(node.name)}
              </text>
              {(hover === node.id || nodes.length <= 12) && (
                <text
                  y={r + 16}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={hover === node.id ? 600 : 400}
                  fill={hover === node.id ? "#241F18" : "#6B6355"}
                  style={{ pointerEvents: "none" }}
                >
                  {node.name.split(" ")[0]}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* hover tooltip */}
      {hoveredNode && (
        <div className="pointer-events-none absolute left-4 top-4 rounded-xl border border-line bg-surface-overlay/95 p-3 shadow-raised backdrop-blur-xl">
          <p className="font-display text-sm font-semibold text-content">{hoveredNode.name}</p>
          <p className="text-xs text-content-muted">{hoveredNode.title}</p>
          <div className="mt-1.5 flex items-center gap-3 text-2xs text-content-subtle">
            <span>{hoveredNode.department}</span>
            <span className="text-content">{hoveredNode.comm_count} messages</span>
          </div>
        </div>
      )}
    </div>
  );
}
