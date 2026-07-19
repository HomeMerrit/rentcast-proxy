/**
 * Kit identity — the pure 2D core of the ape kit system. Squad numbers,
 * pattern traits and the pattern artwork all live here with NO three.js
 * dependency, so flat surfaces (cards, chips, badges) can share the exact
 * same identity as the 3D character without pulling in the GLB pipeline.
 * ApeAgentModel wraps these into textures for the character itself.
 */

export interface ApeJersey {
  number: number;
  label?: string;
}

export type ApePattern = "bolt" | "stripes" | "hoops" | "chevron" | "sash" | "dots";

/** the approved streetwear set — loud, clean under the number at floor scale
 *  (chevron/sash still render for dev previews but aren't dealt as traits) */
const PATTERNS: ApePattern[] = ["bolt", "stripes", "hoops", "dots"];

/** The one key an agent's kit is dealt from. Seed first so the hire-studio
 *  preview IS the kit the agent walks out with (re-rolling the seed re-rolls
 *  the whole kit); id keeps old agents stable if a seed is ever missing. */
export function kitKeyOf(a: { avatar_seed?: string | null; id: string }): string {
  return a.avatar_seed || a.id;
}

/** stable pattern trait per kit key (offset hash so it doesn't correlate with number) */
export function patternOf(id: string): ApePattern {
  let h = 7;
  for (let i = 0; i < id.length; i++) h = (h * 37 + id.charCodeAt(i)) >>> 0;
  return PATTERNS[h % PATTERNS.length];
}

/** stable 2-digit squad number per kit key */
export function jerseyNumberOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 99) + 1;
}

// sRGB↔linear round trip so shades match three.js Color.lerp (which lerps in
// the linear working space) — the 2D chips and the 3D vest stay the same color.
const s2l = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const l2s = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

function lerpHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => {
    const la = s2l(((pa >> shift) & 255) / 255);
    const lb = s2l(((pb >> shift) & 255) / 255);
    return Math.round(l2s(la + (lb - la) * t) * 255);
  };
  return (
    "#" + [16, 8, 0].map((s) => ch(s).toString(16).padStart(2, "0")).join("")
  );
}

/** light/dark tonal shades of an accent — the two inks every kit pattern uses */
export function kitShades(accent: string): { light: string; dark: string } {
  return {
    light: lerpHex(accent, "#ffffff", 0.45),
    dark: lerpHex(accent, "#1E1B18", 0.4),
  };
}

/** Draws the kit pattern in light/dark shades of the agent's own accent on a
 *  transparent canvas — the vest color shows through, so kits stay tonal.
 *  Artwork is authored at 512 and scaled, so any canvas size works. */
export function vestPatternCanvas(pattern: ApePattern, accent: string, size = 512): HTMLCanvasElement {
  const { light, dark } = kitShades(accent);
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const ctx = cv.getContext("2d")!;
  ctx.clearRect(0, 0, size, size);
  ctx.scale(size / 512, size / 512);
  switch (pattern) {
    case "bolt": {
      ctx.fillStyle = light;
      ctx.strokeStyle = dark;
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.moveTo(300, 30); ctx.lineTo(150, 280); ctx.lineTo(240, 280);
      ctx.lineTo(190, 490); ctx.lineTo(370, 220); ctx.lineTo(272, 220);
      ctx.lineTo(340, 30); ctx.closePath();
      ctx.fill(); ctx.stroke();
      break;
    }
    case "stripes": {
      ctx.save();
      ctx.translate(256, 256); ctx.rotate(-0.45);
      ctx.fillStyle = light;
      ctx.fillRect(-90, -400, 90, 800);
      ctx.fillStyle = dark;
      ctx.fillRect(30, -400, 46, 800);
      ctx.restore();
      break;
    }
    case "hoops": {
      ctx.fillStyle = dark;
      for (const y of [70, 230, 390]) ctx.fillRect(0, y, 512, 62);
      ctx.fillStyle = light;
      for (const y of [132, 292, 452]) ctx.fillRect(0, y, 512, 16);
      break;
    }
    case "chevron": {
      ctx.strokeStyle = light;
      ctx.lineWidth = 46;
      ctx.lineJoin = "miter";
      for (const y of [110, 260, 410]) {
        ctx.beginPath();
        ctx.moveTo(60, y); ctx.lineTo(256, y + 110); ctx.lineTo(452, y);
        ctx.stroke();
      }
      break;
    }
    case "sash": {
      ctx.save();
      ctx.translate(256, 256); ctx.rotate(0.6);
      ctx.fillStyle = dark;
      ctx.fillRect(-400, -60, 800, 120);
      ctx.fillStyle = light;
      ctx.fillRect(-400, 60, 800, 22);
      ctx.restore();
      break;
    }
    case "dots": {
      ctx.fillStyle = light;
      for (let row = 0; row < 6; row++) {
        const r = 26 - row * 3;
        for (let col = 0; col < 5; col++) {
          const x = 70 + col * 96 + (row % 2 ? 48 : 0);
          ctx.beginPath();
          ctx.arc(x, 60 + row * 82, Math.max(r, 8), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }
  }
  return cv;
}
