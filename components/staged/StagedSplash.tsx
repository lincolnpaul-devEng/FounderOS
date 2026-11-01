'use client';

import { useEffect, useRef, useState } from 'react';
import { INTRO, StatedLogo, T0, paletteFrom, sample } from './logoc';
import { STAGED_SPLASH_FLAG } from './StagedAuth';

/**
 * The post-login take (the html's sequence, carried over): after the sign-in
 * hands over, the mark forms itself over the dashboard with its noise trails
 * and then dissolves. Nothing lies to the user here — the splash is a stage
 * transition, not a loading state: the console is already interactive under
 * it (pointer-events: none, no claim of work in progress, no focus hijack).
 *
 * StagedAuth raises the sessionStorage flag just before navigating away; this
 * component (mounted once in the root layout) reads and clears it, so the
 * splash plays once per sign-in — a browser refresh does not walk the
 * sequence again. With reduced motion the splash does not play at all: the
 * console has already opened, so the animation would just spin for nothing.
 */
export function StagedSplash() {
  const el = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [run, setRun] = useState(false);

  useEffect(() => {
    const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (sessionStorage.getItem(STAGED_SPLASH_FLAG) === '1' && !reduce) {
      sessionStorage.removeItem(STAGED_SPLASH_FLAG);
      setRun(true);
      return;
    }
    // Either it already played, or reduced motion skips it: the flag never
    // waits around — it dies here, so a later dashboard visit is quiet.
    sessionStorage.removeItem(STAGED_SPLASH_FLAG);
  }, []);

  useEffect(() => {
    if (!run) return;
    const host = el.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    const logo = new StatedLogo(canvas, 560, 640);
    const pal = paletteFrom(host);
    let raf = 0;
    let fadeTimer = 0;
    let fading = false;
    let dirty = true;

    const fit = () => {
      logo.resize(Math.min(window.innerWidth / 1000, window.innerHeight / 700, 1.18));
      dirty = true;
    };

    const startMs = performance.now() - (2.15 - T0) * 1000; // the first frame samples t=2.15

    const frame = () => {
      const t = T0 + (performance.now() - startMs) / 1000;
      if (dirty || t < 4.2) {
        logo.draw(sample(INTRO, t), 1, 1, pal);
        dirty = false;
      }
      // Keyframes settle at 4.2; a hair past it the take is complete — start
      // dissolving, stop drawing, and resolve React after the CSS fade.
      if (t >= 4.35 && !fading) {
        fading = true;
        host.classList.add('staged-splash-out');
        fadeTimer = window.setTimeout(() => setRun(false), 480);
        return;
      }
      raf = requestAnimationFrame(frame);
    };

    window.addEventListener('resize', fit);
    fit();
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(fadeTimer);
      window.removeEventListener('resize', fit);
    };
  }, [run]);

  if (!run) return null;
  return (
    <div className="staged-splash" ref={el} aria-hidden="true">
      <canvas className="staged-canvas staged-canvas-logo" ref={canvasRef} role="presentation" />
    </div>
  );
}
