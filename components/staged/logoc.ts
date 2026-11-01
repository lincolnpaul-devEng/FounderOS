/**
 * The Stated logo engine, ported 1:1 from the hand-authored canvas app in
 * "Stated Welcome Screen.html" (repo root): three discs with noise-textured
 * motion trails, driven by an eased keyframe sampler.
 *
 * Two consumers, same sequence:
 *   - components/staged/StagedAuth.tsx   — /login intro + loader loop
 *   - components/staged/StagedSplash.tsx — post-login formation over the dashboard
 *
 * The renderer is deliberately element-agnostic (no React state inside the
 * frame loop): the caller keeps the timeline, the engine just draws frames.
 */

export const KEYS = ['R', 'ds', 'phi', 'sigma', 'headA', 'tailA', 'tube', 'ghost', 'm', 'e'] as const;
export type KFKey = (typeof KEYS)[number];

/** One keyframe of the logo formation. */
export type StatedKF = { t: number } & Record<KFKey, number>;

export function K(t: number, ...values: number[]): StatedKF {
  const o = { t } as Record<KFKey, number> & { t: number };
  KEYS.forEach((k, i) => {
    o[k] = values[i];
  });
  return o as StatedKF;
}

/**
 * The formation timeline. t is seconds from a T0 of 2.1 (so the intro runs at
 * 0.05 → 2.1s wall time); the e axis drops the trail ends onto the triangle
 * edge, m moves the anchor from the hero pose to its rests.
 *
 *        t     R    ds   phi  sigma headA tailA tube ghost m  e
 */
export const INTRO: StatedKF[] = [
  K(2.15, 0.08, 0, -40, 0, 1, 0, 0, 0, 0, 0),
  K(2.25, 0.22, 0.32, -25, -25, 1, 0, 0, 0.6, 0, 0),
  K(2.4, 0.55, 0.85, -5, -40, 1, 0, 0, 1, 0, 0),
  K(2.55, 0.75, 1, -15, -35, 1, 0, 0, 1, 0, 0),
  K(2.7, 1.0, 1, -15, -30, 1, 0, 0, 0.8, 0, 0),
  K(2.85, 1.12, 1, 0, 75, 0.7, 0, 1, 0.2, 0, 1),
  K(3.0, 0.62, 1, 60, -55, 0.75, 0.35, 1, 0, 0, 0),
  K(3.45, 0.62, 1, 60, -55, 0.75, 0.35, 1, 0, 0, 0),
  K(3.6, 1.0, 1, 0, 75, 0.7, 0, 1, 0, 0, 1),
  K(3.85, 1.0, 1, 0, 75, 0.7, 0, 1, 0, 0, 1),
  K(4.2, 1.0, 1, 0, 75, 0.7, 0, 1, 0, 1, 1),
];

/** The loader loop: same language, always at the centre anchor (m stays 1). */
export const LOADER: StatedKF[] = [
  K(0, 0.1, 0.28, -40, 0, 1, 0, 0, 0, 1, 0),
  K(0.25, 0.3, 0.5, -20, -30, 1, 0, 0, 0.8, 1, 0),
  K(0.5, 0.6, 0.8, -10, -40, 1, 0, 0, 1, 1, 0),
  K(0.75, 0.62, 1, 60, -55, 0.75, 0.35, 1, 0, 1, 0),
  K(1.0, 0.62, 1, 60, -55, 0.75, 0.35, 1, 0, 1, 0),
  K(1.3, 1.0, 1, 0, 75, 0.7, 0, 1, 0, 1, 1),
  K(2.3, 1.0, 1, 0, 75, 0.7, 0, 1, 0, 1, 1),
  K(2.55, 0.62, 1, 60, -55, 0.75, 0.35, 1, 0, 1, 0),
  K(3.0, 0.62, 1, 60, -55, 0.75, 0.35, 1, 0, 1, 0),
  K(3.4, 1.0, 1, 0, 75, 0.7, 0, 1, 0, 1, 1),
];

/** Timeline rests at T0; screen time = T0 + (wall - startMs) / 1000. */
export const T0 = 2.1;

/** Vertical squash of the draw transform: the mark sits inside a taller canvas than its own radius. */
export const STR = 1.4;
export const R0 = 102;
export const RD = 35;

/** Ease of the sampler: smoothstep (matches the hand-authored curve exactly). */
export const ease = (u: number): number => u * u * (3 - 2 * u);

/** Sample the keyframe set at t, easing between the two brackets. */
export function sample(kfs: StatedKF[], t: number): StatedKF {
  if (t <= kfs[0].t) return kfs[0];
  const last = kfs[kfs.length - 1];
  if (t >= last.t) return last;
  let i = 0;
  while (kfs[i + 1].t < t) i++;
  const a = kfs[i], b = kfs[i + 1];
  const u = ease((t - a.t) / (b.t - a.t));
  const o = {} as Record<KFKey | 't', number>;
  o.t = a.t + (b.t - a.t) * u;
  KEYS.forEach((k) => {
    o[k] = a[k] + (b[k] - a[k]) * u;
  });
  return o as StatedKF;
}

/* ---- palette ---- */

type RGB = readonly [number, number, number];

/** Parse "217 217 217", a hash-hex color, or "rgb(217, 217, 217)" from a CSS var. */
export function rgbFrom(el: Element, name: string): RGB | null {
  const raw = getComputedStyle(el).getPropertyValue(name).trim();
  if (!raw) return null;
  if (raw.startsWith('#')) {
    const s = raw.slice(1);
    const hex = s.length === 3 ? s[0] + s[0] + s[1] + s[1] + s[2] + s[2] : s;
    if (!/^[0-9a-f]{6}$/i.test(hex)) return null;
    return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
  }
  const m = raw.match(/(-?\d+(?:\.\d+)?)[ ,]+(-?\d+(?:\.\d+)?)[ ,]+(-?\d+(?:\.\d+)?)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** The hex-free API surface is only used through palette — the fallbacks here
    mirror globals.css (.staged) for the rare case the tokens are absent in the
    sandbox where search transcripts run tests; they are kept in one place. */
export const FALLBACK = {
  disc: [217, 217, 217],
  discDim: [80, 80, 80],
  trail: [205, 205, 205],
  trailDim: [90, 90, 90],
  text: [241, 241, 241],
} satisfies Record<string, RGB>;

/**
 * The tone curve the hand-authored page draws the mark with: the discs lerp on
 * a tone axis between the dim and lit greys, the trails between darker and
 * lighter ones. Both pairs come from the .staged tokens; tone itself goes
 * 1 → 0.35 across the submit dim.
 */
export type Palette = {
  disc: RGB;
  discDim: RGB;
  trail: RGB;
  trailDim: RGB;
  text: RGB;
};

export function paletteFrom(el: Element): Palette {
  const pick = (name: string, fallback: RGB): RGB => rgbFrom(el, name) ?? fallback;
  return {
    disc: pick('--staged-disc', FALLBACK.disc),
    discDim: pick('--staged-disc-dim', FALLBACK.discDim),
    trail: pick('--staged-trail', FALLBACK.trail),
    trailDim: pick('--staged-trail-dim', FALLBACK.trailDim),
    text: pick('--staged-text', FALLBACK.text),
  };
}

/** Interpolate two triplets at u. */
export function mix(a: RGB, b: RGB, u: number): RGB {
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
}

/**
 * Renderer. One instance per canvas; resize(k) sizes the backing store with
 * the stage's kScale (and the device pixel ratio, capped at 2) and rebuilds
 * the noise table the trails are textured through.
 */
export class StatedLogo {
  private ctx: CanvasRenderingContext2D;
  private tc: HTMLCanvasElement;
  private tctx: CanvasRenderingContext2D;
  private s = 1;
  private noise = new Uint8Array(0);

  constructor(
    private canvas: HTMLCanvasElement,
    private w: number,
    private h: number,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d canvas unavailable');
    this.ctx = ctx;
    this.tc = document.createElement('canvas');
    const tctx = this.tc.getContext('2d', { willReadFrequently: true });
    if (!tctx) throw new Error('2d canvas unavailable');
    this.tctx = tctx;
  }

  resize(k: number): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const s = Math.min(k * dpr, 1500 / Math.max(this.w, this.h));
    this.canvas.width = this.tc.width = Math.max(2, Math.round(this.w * s));
    this.canvas.height = this.tc.height = Math.max(2, Math.round(this.h * s));
    this.s = this.canvas.width / this.w;
    const n = new Uint8Array(this.canvas.width * this.canvas.height);
    for (let i = 0; i < n.length; i++) n[i] = (Math.random() * 255) | 0;
    this.noise = n;
  }

  /**
   * Draw one pose. p is a sampled keyframe; S the anchor scale (hero→rest),
   * tone 1=lit → 0.35 submits, 0=busy.
   */
  draw(p: StatedKF, S: number, tone: number, pal: Palette): void {
    const ctx = this.ctx, tctx = this.tctx;
    const W = this.canvas.width, H = this.canvas.height, s = this.s;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const rad = Math.PI / 180;
    const pts: [number, number][] = [], ends: [number, number][] = [];
    const sg = p.sigma < 0 ? -1 : 1, fr = Math.abs(p.sigma) / 120;

    // Disc anchors on the R0 circle, and the trail end of each: the arm director
    // blended toward the 120° neighbour by fr, toward the "true" arc by e.
    const vert = (deg: number): [number, number] => {
      const q = deg * rad;
      return [Math.sin(q) * p.R * R0, -Math.cos(q) * p.R * R0];
    };
    for (let i = 0; i < 3; i++) {
      const th = p.phi + 120 * i;
      const pa = vert(th);
      const arc = vert(th + p.sigma);
      const nx = vert(th + sg * 120);
      const edge: [number, number] = [pa[0] + (nx[0] - pa[0]) * fr, pa[1] + (nx[1] - pa[1]) * fr];
      pts.push(pa);
      ends.push([arc[0] * (1 - p.e) + edge[0] * p.e, arc[1] * (1 - p.e) + edge[1] * p.e]);
    }

    const r = RD * p.ds;
    if (r < 0.3) return;

    const setT = (c: CanvasRenderingContext2D) => c.setTransform(s * S, 0, 0, s * S * STR, W / 2, H / 2);

    if (p.tube > 0.01) {
      // Trails: soft alpha strokes pushed through a noise table, so the comet
      // tails keep film grain instead of vector cleanliness.
      tctx.setTransform(1, 0, 0, 1, 0, 0);
      tctx.clearRect(0, 0, W, H);
      setT(tctx);
      tctx.lineCap = 'round';
      tctx.lineWidth = 2 * r;
      for (let i = 0; i < 3; i++) {
        const g = tctx.createLinearGradient(pts[i][0], pts[i][1], ends[i][0], ends[i][1]);
        const [tr, tg, tb] = pal.text;
        g.addColorStop(0, `rgba(${Math.round(tr)},${Math.round(tg)},${Math.round(tb)},${p.headA * p.tube})`);
        g.addColorStop(1, `rgba(${Math.round(tr)},${Math.round(tg)},${Math.round(tb)},${p.tailA * p.tube})`);
        tctx.strokeStyle = g;
        tctx.beginPath();
        tctx.moveTo(pts[i][0], pts[i][1]);
        tctx.lineTo(ends[i][0], ends[i][1]);
        tctx.stroke();
      }
      tctx.setTransform(1, 0, 0, 1, 0, 0);
      const id = tctx.getImageData(0, 0, W, H);
      const d = id.data, n = this.noise;
      const v = this.lerpTriplet(pal.trailDim, pal.trail, tone);
      for (let q = 0, j = 3; q < n.length; q++, j += 4) {
        let o = (d[j] - n[q]) * 3 + 110;
        if (d[j] === 0) o = 0;
        d[j - 3] = v[0];
        d[j - 2] = v[1];
        d[j - 1] = v[2];
        d[j] = o < 0 ? 0 : o > 255 ? 255 : o;
      }
      tctx.putImageData(id, 0, 0);
      ctx.drawImage(this.tc, 0, 0);
    }

    setT(ctx);
    const [cr, cg, cb] = this.lerpTriplet(pal.discDim, pal.disc, tone);
    ctx.fillStyle = `rgb(${Math.round(cr)},${Math.round(cg)},${Math.round(cb)})`;
    if (p.ghost > 0.02) {
      // Ghosts: the discs smeared along their own approach.
      for (let i = 0; i < 3; i++) {
        for (let k = 5; k >= 1; k--) {
          const f = (k / 5) * 0.3;
          ctx.globalAlpha = 0.2 * p.ghost * (1 - k / 6);
          ctx.beginPath();
          ctx.arc(pts[i][0] + (ends[i][0] - pts[i][0]) * f, pts[i][1] + (ends[i][1] - pts[i][1]) * f, r, 0, 6.2832);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(pts[i][0], pts[i][1], r, 0, 6.2832);
      ctx.fill();
    }
  }

  private lerpTriplet(dim: RGB, lit: RGB, tone: number): RGB {
    return mix(dim, lit, tone);
  }
}
