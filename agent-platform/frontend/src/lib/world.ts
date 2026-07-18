// ── The living world engine ───────────────────────────────────────────────────
// Ported from design/living-world-concept.html into the product as reusable IP.
// The world IS the product: departments are buildings (taller = bigger team),
// workers are little citizens in their team colour, value pops as gold coins.
// Pure functions that return SVG strings — no DOM, SSR-safe. A React wrapper
// (components/world/LivingWorld.tsx) injects the result.

export type DeptType = "sales" | "support" | "finance" | "ops" | "eng" | "mktg" | "hq";

export const DEPT_COLOR: Record<DeptType, string> = {
  sales: "#5A97D6",
  support: "#4FB0AA",
  finance: "#E6AE3C",
  ops: "#E08A5B",
  eng: "#8B79D4",
  mktg: "#E06A9A",
  hq: "#EFE4D0",
};

const COL = { cream: "#F0E6D4", roofgold: "#EDBE5E", grass: "#93C489", soil: "#C7A278" };

// Map any department name coming from the backend to a world building type.
export function deptType(name: string): DeptType {
  const n = (name || "").toLowerCase();
  if (n.startsWith("sale")) return "sales";
  if (n.startsWith("support") || n.startsWith("success") || n.startsWith("customer")) return "support";
  if (n.startsWith("financ") || n.startsWith("account") || n.startsWith("billing")) return "finance";
  if (n.startsWith("op") || n.startsWith("logisti") || n.startsWith("fulfil")) return "ops";
  if (n.startsWith("eng") || n.startsWith("dev") || n.startsWith("data") || n.startsWith("research") || n.startsWith("product")) return "eng";
  if (n.startsWith("market") || n.startsWith("brand") || n.startsWith("content") || n.startsWith("creativ")) return "mktg";
  return "hq";
}

// ── geometry helpers ──────────────────────────────────────────────────────────
function shade(hex: string, f: number): string {
  const c = parseInt(hex.slice(1), 16);
  let r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
  const t = f < 0 ? 0 : 255, a = Math.abs(f);
  r = Math.round((t - r) * a) + r;
  g = Math.round((t - g) * a) + g;
  b = Math.round((t - b) * a) + b;
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
type Pt = [number, number];
const P = (a: Pt[]) => a.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const up = (p: Pt, h: number): Pt => [p[0], p[1] - h];
const fp = (o: Pt, a: Pt, b: Pt, x: number, y: number): Pt => [o[0] + a[0] * x + b[0] * y, o[1] + a[1] * x + b[1] * y];

type Placer = (u: number, v: number) => Pt;
export function world(ISX: number, ISY: number, WX: number, WY: number): Placer {
  return (u, v) => [ISX + (u - v) * WX, ISY + (u + v) * WY];
}

function island(place: Placer, D: number, grass: string, soil: string): string {
  const top = place(0, 0), right = place(1, 0), bot = place(1, 1), left = place(0, 1);
  const L: Pt[] = [left, bot, [bot[0], bot[1] + D], [left[0], left[1] + D]];
  const R: Pt[] = [bot, right, [right[0], right[1] + D], [bot[0], bot[1] + D]];
  return (
    '<polygon points="' + P(L) + '" fill="' + soil + '"/>' +
    '<polygon points="' + P(R) + '" fill="' + shade(soil, -0.16) + '"/>' +
    '<polygon points="' + P([top, right, bot, left]) + '" fill="' + shade(grass, 0.05) + '"/>'
  );
}

interface Box { A: Pt; B: Pt; C: Pt; D: Pt; At: Pt; Bt: Pt; Ct: Pt; Dt: Pt; walls: string; wall: string; }
function box(place: Placer, u: number, v: number, su: number, H: number, wall: string): Box {
  const A = place(u - su, v - su), B = place(u + su, v - su), C = place(u + su, v + su), D = place(u - su, v + su);
  const At = up(A, H), Bt = up(B, H), Ct = up(C, H), Dt = up(D, H);
  const left = shade(wall, -0.03), rightC = shade(wall, -0.17);
  const s =
    '<polygon points="' + P([C, D, Dt, Ct]) + '" fill="' + left + '"/>' +
    '<polygon points="' + P([B, C, Ct, Bt]) + '" fill="' + rightC + '"/>';
  return { A, B, C, D, At, Bt, Ct, Dt, walls: s, wall };
}
const flatRoof = (bx: Box, col?: string) => '<polygon points="' + P([bx.At, bx.Bt, bx.Ct, bx.Dt]) + '" fill="' + (col || shade(bx.wall, 0.09)) + '"/>';

function windows(bx: Box, rows: number): string {
  const o = bx.Bt, a: Pt = [bx.Ct[0] - bx.Bt[0], bx.Ct[1] - bx.Bt[1]], b: Pt = [bx.B[0] - bx.Bt[0], bx.B[1] - bx.Bt[1]];
  let s = ""; const cols = 2;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = (c + 0.5) / cols, y = (r + 0.55) / rows, ww = 0.62 / cols, wh = 0.5 / rows;
    const p0 = fp(o, a, b, x - ww / 2, y - wh / 2), p1 = fp(o, a, b, x + ww / 2, y - wh / 2),
      p2 = fp(o, a, b, x + ww / 2, y + wh / 2), p3 = fp(o, a, b, x - ww / 2, y + wh / 2);
    s += '<polygon class="win" points="' + P([p0, p1, p2, p3]) + '" fill="var(--window,rgba(64,84,104,.28))"/>';
  }
  return s;
}
function gable(bx: Box, col: string, rh: number): string {
  const r1 = up(mid(bx.At, bx.Dt), rh), r2 = up(mid(bx.Bt, bx.Ct), rh);
  return (
    '<polygon points="' + P([bx.Dt, bx.Ct, r2, r1]) + '" fill="' + shade(col, -0.05) + '"/>' +
    '<polygon points="' + P([bx.At, bx.Bt, r2, r1]) + '" fill="' + col + '"/>' +
    '<polygon points="' + P([bx.At, bx.Dt, r1]) + '" fill="' + shade(col, -0.12) + '"/>' +
    '<polygon points="' + P([bx.Bt, bx.Ct, r2]) + '" fill="' + shade(col, -0.18) + '"/>'
  );
}

// A department building. `grow` (0..1) scales height so a bigger team = a taller tower.
function deptBuilding(place: Placer, u: number, v: number, type: DeptType, grow = 0.5): { svg: string; key: number } {
  const c = DEPT_COLOR[type];
  const g = 0.7 + Math.max(0, Math.min(1, grow)) * 0.8; // height multiplier
  let s = "", bx: Box;
  if (type === "sales") {
    bx = box(place, u, v, 0.12, 72 * g, c); s += bx.walls + windows(bx, 3) + flatRoof(bx, shade(c, 0.12));
    s += '<polygon points="' + P([bx.At, bx.Bt, bx.Ct, bx.Dt]) + '" fill="' + shade(c, 0.05) + '" opacity=".5"/>';
  } else if (type === "finance") {
    bx = box(place, u, v, 0.115, 54 * g, c); s += bx.walls + flatRoof(bx, shade(c, 0.1));
    const o = bx.Bt, a: Pt = [bx.Ct[0] - bx.Bt[0], bx.Ct[1] - bx.Bt[1]], b: Pt = [bx.B[0] - bx.Bt[0], bx.B[1] - bx.Bt[1]];
    const ctr = fp(o, a, b, 0.5, 0.58), rr = Math.abs(a[0]) * 0.3 + 8;
    s += '<circle cx="' + ctr[0].toFixed(1) + '" cy="' + ctr[1].toFixed(1) + '" r="' + rr.toFixed(1) + '" fill="' + shade(c, -0.28) + '"/>';
    s += '<circle cx="' + ctr[0].toFixed(1) + '" cy="' + ctr[1].toFixed(1) + '" r="' + (rr * 0.62).toFixed(1) + '" fill="none" stroke="' + shade(c, 0.2) + '" stroke-width="3"/>';
  } else if (type === "ops") {
    bx = box(place, u, v, 0.14, 40 * g, c); s += bx.walls + gable(bx, shade(c, 0.06), 26);
    const o = bx.Bt, a: Pt = [bx.Ct[0] - bx.Bt[0], bx.Ct[1] - bx.Bt[1]], b: Pt = [bx.B[0] - bx.Bt[0], bx.B[1] - bx.Bt[1]];
    const d0 = fp(o, a, b, 0.28, 0.35), d1 = fp(o, a, b, 0.72, 0.35), d2 = fp(o, a, b, 0.72, 1), d3 = fp(o, a, b, 0.28, 1);
    s += '<polygon points="' + P([d0, d1, d2, d3]) + '" fill="' + shade(c, -0.24) + '"/>';
  } else if (type === "eng") {
    bx = box(place, u, v, 0.12, 58 * g, c); s += bx.walls + windows(bx, 2) + flatRoof(bx, shade(c, -0.02));
    const o = bx.At, a: Pt = [bx.Bt[0] - bx.At[0], bx.Bt[1] - bx.At[1]], b: Pt = [bx.Dt[0] - bx.At[0], bx.Dt[1] - bx.At[1]];
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      const x = 0.28 + i * 0.44, y = 0.28 + j * 0.44, pw = 0.32, ph = 0.32;
      s += '<polygon points="' + P([fp(o, a, b, x - pw / 2, y - ph / 2), fp(o, a, b, x + pw / 2, y - ph / 2), fp(o, a, b, x + pw / 2, y + ph / 2), fp(o, a, b, x - pw / 2, y + ph / 2)]) + '" fill="#2E4468"/>';
    }
    const c5 = fp(o, a, b, 0.5, 0.5), tip = up(c5, 22);
    s += '<line x1="' + c5[0].toFixed(1) + '" y1="' + c5[1].toFixed(1) + '" x2="' + tip[0].toFixed(1) + '" y2="' + tip[1].toFixed(1) + '" stroke="' + shade(c, -0.3) + '" stroke-width="2.5"/><circle cx="' + tip[0].toFixed(1) + '" cy="' + tip[1].toFixed(1) + '" r="3.4" fill="' + COL.roofgold + '"/>';
  } else if (type === "mktg") {
    bx = box(place, u, v, 0.11, 50 * g, c); s += bx.walls + windows(bx, 2);
    const r1 = up(bx.At, 20), r2 = up(bx.Bt, 20);
    s += '<polygon points="' + P([bx.At, bx.Bt, bx.Ct, bx.Dt]) + '" fill="' + shade(c, 0.08) + '"/>';
    s += '<polygon points="' + P([bx.Dt, bx.Ct, r2, r1]) + '" fill="' + shade(c, 0.16) + '"/>';
    s += '<polygon points="' + P([bx.At, r1, r2, bx.Bt]) + '" fill="' + shade(c, -0.06) + '"/>';
  } else if (type === "support") {
    bx = box(place, u, v, 0.11, 48 * g, c); s += bx.walls + windows(bx, 2) + flatRoof(bx, shade(c, 0.1));
    const ct = mid(bx.At, bx.Ct);
    s += '<ellipse cx="' + ct[0].toFixed(1) + '" cy="' + ct[1].toFixed(1) + '" rx="' + (Math.abs(bx.Bt[0] - bx.Dt[0]) / 2 * 0.7).toFixed(1) + '" ry="14" fill="' + shade(c, 0.14) + '"/>';
  } else {
    bx = box(place, u, v, 0.13, 52 * g, c); s += bx.walls + windows(bx, 2) + gable(bx, COL.roofgold, 26);
  }
  return { svg: s, key: u + v };
}

function tree(place: Placer, u: number, v: number): { svg: string; key: number } {
  const b = place(u, v);
  return {
    svg:
      '<rect x="' + (b[0] - 3) + '" y="' + (b[1] - 16) + '" width="6" height="16" rx="2" fill="#9C7A50"/>' +
      '<circle cx="' + b[0] + '" cy="' + (b[1] - 24) + '" r="15" fill="#8FBE79"/>' +
      '<circle cx="' + (b[0] + 7) + '" cy="' + (b[1] - 20) + '" r="9" fill="#7FB06B"/>' +
      '<circle cx="' + (b[0] - 7) + '" cy="' + (b[1] - 19) + '" r="10" fill="#9FCB88"/>',
    key: u + v,
  };
}

// A worker "citizen" peg in a team colour, with a role-distinct silhouette.
export function peg(pt: Pt, color: string, scale = 1, role = ""): string {
  const b = pt, w = 8 * scale, h = 19 * scale, head = 6 * scale;
  let s = '<ellipse cx="' + b[0] + '" cy="' + (b[1] + 1) + '" rx="' + w * 1.05 + '" ry="' + 3.2 * scale + '" fill="rgba(20,16,10,.16)"/>';
  s += '<path d="M' + (b[0] - w) + " " + b[1] + " q0 -" + h * 0.62 + " " + w + " -" + h * 0.62 + " q" + w + " 0 " + w + " " + h * 0.62 + ' Z" fill="' + color + '"/>';
  const neckY = b[1] - h * 0.62;
  if (role === "sales") s += '<rect x="' + (b[0] + w * 0.5) + '" y="' + (b[1] - h * 0.36) + '" width="' + 6 * scale + '" height="' + 5 * scale + '" rx="1" fill="' + shade(color, -0.25) + '"/>';
  else if (role === "eng") s += '<rect x="' + (b[0] - w - 3 * scale) + '" y="' + (b[1] - h * 0.5) + '" width="' + 4.5 * scale + '" height="' + 9 * scale + '" rx="2" fill="' + shade(color, -0.25) + '"/>';
  else if (role === "finance") s += '<circle cx="' + (b[0] + w * 0.7) + '" cy="' + (b[1] - h * 0.2) + '" r="' + 3.6 * scale + '" fill="' + COL.roofgold + '"/>';
  else if (role === "mktg") s += '<path d="M' + (b[0] + w * 0.4) + " " + (neckY - 2 * scale) + " l" + 8 * scale + " -" + 4 * scale + " l0 " + 9 * scale + ' Z" fill="' + shade(color, -0.15) + '"/>';
  s += '<circle cx="' + b[0] + '" cy="' + (neckY - head * 0.5) + '" r="' + head + '" fill="#F4D9B8"/>';
  if (role === "support") s += '<path d="M' + (b[0] - head - 1) + " " + (neckY - head * 0.5) + " a" + (head + 1) + " " + (head + 1) + " 0 0 1 " + (head + 1) * 2 + ' 0" fill="none" stroke="' + shade(color, -0.2) + '" stroke-width="' + 2 * scale + '"/>';
  s += '<path d="M' + (b[0] - head) + " " + (neckY - head * 0.5) + " a" + head + " " + head + " 0 0 1 " + head * 2 + ' 0 Z" fill="' + shade(color, -0.3) + '" opacity=".5"/>';
  return s;
}

function road(place: Placer, pts: Pt[], hw: number): string {
  const left: Pt[] = [], right: Pt[] = [];
  for (const [u, v] of pts) { left.push(place(u + hw, v - hw)); right.push(place(u - hw, v + hw)); }
  return '<polygon points="' + P(left.concat(right.reverse())) + '" fill="#E9DEC6"/>';
}

// Fixed placement slots on the island, added as the company grows.
const SLOTS: [number, number][] = [
  [0.46, 0.5], [0.72, 0.34], [0.72, 0.68], [0.26, 0.34], [0.28, 0.7], [0.54, 0.16],
  [0.5, 0.84], [0.2, 0.52], [0.8, 0.52], [0.5, 0.5],
];

export interface Building { dept: string; count: number; active?: boolean }

export interface WorldOpts {
  buildings: Building[];
  id: string;          // unique id to scope keyframes
  animate?: boolean;
  width?: number;      // world placer X spread
  showWorkers?: boolean;
  interactive?: boolean; // buildings become clickable (the world is the nav)
}

const escAttr = (s: string) => (s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

// Builds a full company scene. Returns the inner <svg> markup + a viewBox.
export function renderCompany(opts: WorldOpts): { inner: string; viewBox: string } {
  const { buildings, id, animate = true, showWorkers = true, interactive = false } = opts;
  const place = world(560, 70, 360, 176);
  const vb = "40 48 1040 470";

  const maxCount = Math.max(1, ...buildings.map((b) => b.count));
  const base = island(place, 84, COL.grass, COL.soil);
  const roads = road(place, [[0.06, 0.5], [0.94, 0.5]], 0.05) + road(place, [[0.5, 0.06], [0.5, 0.94]], 0.05);

  type Obj = { key: number; svg: string };
  const objs: Obj[] = [];
  const placed: { u: number; v: number; type: DeptType; color: string; count: number; active: boolean }[] = [];

  buildings.slice(0, SLOTS.length).forEach((b, i) => {
    const [u, v] = SLOTS[i];
    const t = deptType(b.dept);
    const grow = b.count / maxCount;
    const g = deptBuilding(place, u, v, t, grow);
    const wrapped = `<g class="b-hit" data-team="${escAttr(b.dept)}"><title>${escAttr(b.dept)}</title>${g.svg}</g>`;
    objs.push({ key: g.key, svg: wrapped });
    placed.push({ u, v, type: t, color: DEPT_COLOR[t], count: b.count, active: !!b.active });
  });

  // a few trees to soften the edges
  [[0.16, 0.5], [0.86, 0.52], [0.5, 0.92], [0.12, 0.72], [0.9, 0.74]].forEach(([u, v]) => {
    const g = tree(place, u, v);
    objs.push({ key: g.key, svg: g.svg });
  });

  // citizens near each building — count encodes headcount (capped, calm not busy)
  if (showWorkers) {
    placed.forEach((b) => {
      const n = Math.max(1, Math.min(4, Math.round(b.count / Math.max(1, maxCount) * 4) || 1));
      for (let k = 0; k < n; k++) {
        const off = (k - (n - 1) / 2) * 0.06;
        const pt = place(b.u + 0.14 + off, b.v + 0.14 - off);
        objs.push({ key: b.u + b.v + 0.0001 * k + 0.5, svg: peg(pt, b.color, 0.85, b.type) });
      }
    });
  }

  objs.sort((a, b) => a.key - b.key);

  // ambient motion: a coin of value pops over active buildings; one worker walks the road
  let css = "", movers = "";
  if (animate) {
    const active = placed.filter((b) => b.active);
    (active.length ? active : placed).slice(0, 3).forEach((b, i) => {
      const p = place(b.u, b.v);
      const key = `${id}-coin${i}`;
      css += `@keyframes ${key}{0%{transform:translate(0,0);opacity:0}14%{opacity:1}62%{opacity:1}100%{transform:translate(0,-30px);opacity:0}}`;
      movers += `<g style="transform:translate(${p[0].toFixed(1)}px,${(p[1] - 44).toFixed(1)}px)"><g style="animation:${key} 3.4s ${(i * 1.1).toFixed(1)}s ease-in-out infinite"><circle r="7" fill="${COL.roofgold}"/><text x="0" y="3.2" font-size="9" text-anchor="middle" fill="#8a6a12" font-family="sans-serif" font-weight="700">$</text></g></g>`;
    });
    const w0 = place(0.14, 0.5), w1 = place(0.86, 0.5);
    const dx = (w1[0] - w0[0]).toFixed(1), dy = (w1[1] - w0[1]).toFixed(1);
    css += `@keyframes ${id}-walk{0%{transform:translate(0,0)}48%{transform:translate(${dx}px,${dy}px)}52%{transform:translate(${dx}px,${dy}px)}100%{transform:translate(0,0)}}`;
    const wc = placed[0]?.color ?? DEPT_COLOR.sales;
    movers += `<g style="transform:translate(${w0[0].toFixed(1)}px,${w0[1].toFixed(1)}px)"><g style="animation:${id}-walk 14s ease-in-out infinite">${peg([0, 0], wc, 0.9, placed[0]?.type ?? "")}</g></g>`;
    css += `@media (prefers-reduced-motion:reduce){#${id} [style*="animation"]{animation:none!important}}`;
  }

  const hit = interactive
    ? `#${id} .b-hit{cursor:pointer;transition:opacity .15s,transform .15s;transform-box:fill-box;transform-origin:center} #${id} .b-hit:hover{opacity:.94}`
    : "";
  const inner =
    `<style>${css}${hit} #${id} .win{fill:var(--window,rgba(64,84,104,.28))}</style>` +
    "<g>" + base + roads + objs.map((o) => o.svg).join("") + movers + "</g>";
  return { inner, viewBox: vb };
}
