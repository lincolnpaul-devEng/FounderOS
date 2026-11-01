'use client';

import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { type Palette, LOADER, INTRO, StatedLogo, T0, ease, paletteFrom, sample } from './logoc';

/**
 * The Stated auth screen (the legacy tree of /login): the welcome animation
 * from the hand-authored "Stated Welcome Screen.html", staged over the real
 * password check.
 *
 * Sequence: the mark forms itself with noise trails while the stage holds,
 * then the title wipes in and the form reveals field → Enter → remember on
 * the html's original timeline. On submit the button presses, the form fades
 * through the busy tone, and the loader loop answers while /api/auth/login is
 * checked. A wrong password rewinds to the form, shakes the field, and says
 * so; a correct one hands over to the dashboard, where StagedSplash replays
 * the formation over the console.
 *
 * The html's typed demo operator, its auto-fill submit, and the name field
 * are deliberately not ported: the console signs in one real operator with
 * one real password, so the screen shows nothing that has not happened.
 *
 *   window.__stated / unfreeze() pins one screen-time for capture runs, as
 * the html did for its recordings.
 */

/** Stage geometry the html authored: hero anchor, rest anchor, form slot. */
type Layout = {
  W: number;
  H: number;
  hx: number;
  hy: number;
  hS: number;
  ax: number;
  ay: number;
  aS: number;
  fx: number;
  fy: number;
  cx: number;
  cy: number;
};

const NARROW: Layout = { W: 520, H: 760, hx: 260, hy: 380, hS: 1.0, ax: 260, ay: 215, aS: 0.8, fx: 130, fy: 420, cx: 260, cy: 380 };
const WIDE: Layout = { W: 1000, H: 700, hx: 500, hy: 350, hS: 1.18, ax: 286, ay: 352, aS: 1, fx: 585, fy: 207, cx: 500, cy: 350 };

/** Timeline events: [screen seconds, run]. Fired one at a time as t crosses them. */
type Ev = [number, () => void];

/** sessionStorage key that asks StagedSplash to play over the next page. */
export const STAGED_SPLASH_FLAG = 'staged-splash';

/** Wrapper so both the React form handler and the DOM handlers share one submit. */
export type StatedSubmit = (e: FormEvent | SubmitEvent | Event) => void;

export function StagedAuth({ brandName }: { brandName: string }) {
  const router = useRouter();
  const params = useSearchParams();

  const stageRef = useRef<HTMLDivElement | null>(null);
  const logoRef = useRef<HTMLCanvasElement | null>(null);
  const loadRef = useRef<HTMLCanvasElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const passRef = useRef<HTMLInputElement | null>(null);
  const enterRef = useRef<HTMLButtonElement | null>(null);
  const rememberRef = useRef<HTMLLabelElement | null>(null);
  const boxRef = useRef<HTMLInputElement | null>(null);

  // The stage runs outside React state: a frame loop, not re-renders.
  const startMs = useRef(0);
  const submitAt = useRef<number | null>(null);
  const fired = useRef(0);
  const frozen = useRef<number | null>(null);
  const dirty = useRef(true);
  const reduce = useRef(false);
  const layoutRef = useRef<Layout>(WIDE);
  const logo = useRef<StatedLogo | null>(null);
  const loader = useRef<StatedLogo | null>(null);
  const pal = useRef<Palette | null>(null);
  /** The effect swaps this to the real submit; the form invokes it. */
  const invoke = useRef<StatedSubmit>(submitPlaceholder);

  // True auth failures surface under the form; nothing else is a message.
  const [msg, setMsg] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => invoke.current(e);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    reduce.current = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const setup = () => {
      const L = window.innerWidth < 640 ? NARROW : WIDE;
      layoutRef.current = L;
      const kScale = Math.min(window.innerWidth / L.W, window.innerHeight / L.H, 1.8);
      stage.style.width = L.W + 'px';
      stage.style.height = L.H + 'px';
      stage.style.setProperty('--staged-k', String(kScale));
      if (formRef.current) {
        formRef.current.style.left = L.fx + 'px';
        formRef.current.style.top = L.fy + 'px';
      }
      if (loadRef.current) loadRef.current.style.transform = `translate(${L.cx - 150}px,${L.cy - 170}px)`;
      logo.current?.resize(kScale);
      loader.current?.resize(kScale);
      pal.current = paletteFrom(stage);
      dirty.current = true;
    };

    const reveal = (el: HTMLElement, kf: Keyframe[], ms: number) => {
      el.classList.remove('staged-pre');
      el.animate(kf, { duration: ms, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' });
    };

    const ev: Ev[] = [
      // 4.00: the title wipes open.
      [
        4.0,
        () => {
          const t = titleRef.current;
          if (!t) return;
          t.classList.remove('staged-pre');
          t.animate(
            [{ clipPath: 'inset(-20% 100% -20% 0)' }, { clipPath: 'inset(-20% 0% -20% 0)' }],
            { duration: 420, easing: 'cubic-bezier(.3,.6,.3,1)', fill: 'both' },
          );
        },
      ],
      // 4.75/4.95/5.35: field reveal, Enter reveal, remember reveal.
      [4.75, () => passRef.current && reveal(passRef.current, [{ transform: 'scale(.3,.1)', opacity: 0.5 }, { transform: 'none', opacity: 1 }], 300)],
      [4.95, () => enterRef.current && reveal(enterRef.current, [{ transform: 'scale(.22,.18)', opacity: 1 }, { transform: 'none', opacity: 1 }], 320)],
      [5.35, () => rememberRef.current && reveal(rememberRef.current, [{ opacity: 0 }, { opacity: 1 }], 350)],
    ];

    const shake = () => {
      const p = passRef.current;
      if (!p) return;
      p.classList.remove('staged-shake');
      void p.offsetWidth;
      p.classList.add('staged-shake');
    };

    const rewind = (reason: string) => {
      [titleRef, passRef, enterRef, rememberRef].forEach((r) => {
        const el = r.current;
        if (!el) return;
        el.getAnimations().forEach((a) => a.cancel());
        el.classList.add('staged-pre');
        if (el === enterRef.current) el.classList.remove('staged-pressed', 'staged-busy');
      });
      const p = passRef.current;
      if (p) p.classList.remove('staged-shake');
      if (p) p.value = '';
      if (boxRef.current) boxRef.current.checked = false;
      if (formRef.current) formRef.current.style.opacity = '1';
      if (logoRef.current) logoRef.current.style.opacity = '1';
      if (loadRef.current) loadRef.current.style.opacity = '0';
      submitAt.current = null;
      fired.current = 0;
      dirty.current = true;
      startMs.current = performance.now() - (reduce.current ? (5.6 - T0) * 1000 : 0);
      setMsg(reason);
      if (reason) shake();
    };

    // resetAll: the same rewind as a failure, minus the message and shake.
    const resetAll = () => rewind('');

    const startLoading = () => {
      if (submitAt.current === null) {
        submitAt.current = performance.now();
        dirty.current = true;
      }
    };

    const submit: StatedSubmit = (e) => {
      e.preventDefault();
      const p = passRef.current;
      if (!p || submitAt.current !== null) return;
      if (!p.value) {
        // Empty submit: shake the field and never ask the server.
        shake();
        p.focus();
        return;
      }
      startLoading();
      const password = p.value;
      fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, stay: boxRef.current?.checked ?? false }),
      }).then(
        // Live now: the loader keeps answering until the page navigates.
        (res) => {
          if (res.ok) {
            sessionStorage.setItem(STAGED_SPLASH_FLAG, '1');
            router.replace(params.get('next') || '/');
            router.refresh();
            return;
          }
          res
            .json()
            .catch(() => null)
            .then((body: unknown) => {
              const err = (body as { error?: string } | null)?.error;
              rewind(err ?? 'wrong password');
            });
        },
        () => rewind('could not reach the server'),
      );
    };

    invoke.current = submit;

    const frame = () => {
      const t = frozen.current !== null ? frozen.current : T0 + (performance.now() - startMs.current) / 1000;
      while (fired.current < ev.length && ev[fired.current][0] <= t) {
        ev[fired.current][1]();
        fired.current++;
      }
      const lt = submitAt.current === null ? -1 : frozen.current !== null ? Math.max(0, frozen.current - 7.55) : (performance.now() - submitAt.current) / 1000;
      const palette = pal.current ?? paletteFrom(stage);
      let tone = 1;
      if (lt >= 0) {
        enterRef.current?.classList.toggle('staged-pressed', lt < 0.25);
        enterRef.current?.classList.toggle('staged-busy', lt >= 0.25);
        tone = 1 - 0.65 * ease(Math.min(1, Math.max(0, (lt - 0.3) / 0.3)));
        if (formRef.current) formRef.current.style.opacity = lt >= 0.75 ? '0' : lt >= 0.45 ? '0.18' : '1';
        if (lt >= 0.85 && logoRef.current) logoRef.current.style.opacity = '0';
      }
      const animating = t < 4.3 || (lt >= 0 && lt < 1.3);
      if (animating || dirty.current) {
        const L = layoutRef.current;
        const p = sample(INTRO, t);
        const S = L.hS + (L.aS - L.hS) * p.m;
        const cx = L.hx + (L.ax - L.hx) * p.m;
        const cy = L.hy + (L.ay - L.hy) * p.m;
        logoRef.current?.style.setProperty('transform', `translate(${cx - 280}px,${cy - 320}px)`);
        logo.current?.draw(p, S, tone, palette);
        dirty.current = false;
      }
      if (lt >= 0.45 && loadRef.current) {
        loadRef.current.style.opacity = '1';
        let q = lt - 0.45;
        if (q > 3.4) q = 1.3 + ((q - 1.3) % 2.1);
        loader.current?.draw(sample(LOADER, q), 0.4, 1, palette);
      }
      raf = requestAnimationFrame(frame);
    };

    let raf = 0;
    logo.current = logoRef.current ? new StatedLogo(logoRef.current, 560, 640) : null;
    loader.current = loadRef.current ? new StatedLogo(loadRef.current, 300, 340) : null;
    window.addEventListener('resize', setup);
    document.fonts?.ready.then(() => {
      dirty.current = true;
    });

    // Capture hooks, the same window key the html used for recordings.
    (window as unknown as Record<string, unknown>).__stated = {
      freeze: (t: number) => {
        frozen.current = t;
      },
      unfreeze: () => {
        frozen.current = null;
      },
    };

    setup();
    resetAll();
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', setup);
      delete (window as unknown as Record<string, unknown>).__stated;
    };
    // Runs once; refs bind the DOM for the life of the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submitPlaceholder(_e: FormEvent | SubmitEvent | Event) {
    /* replaced by the effect's submit on mount */
  }

  return (
    <main className="staged" aria-label={`Sign in to ${brandName}`}>
      <div className="staged-stage" ref={stageRef}>
        <canvas className="staged-canvas staged-canvas-logo" ref={logoRef} aria-label="Stated logo: three discs with motion trails" role="img" />
        <canvas className="staged-canvas staged-canvas-loader" ref={loadRef} aria-hidden="true" style={{ opacity: 0 }} />
        <form className="staged-form" ref={formRef} onSubmit={handleSubmit} autoComplete="off" noValidate>
          <h1 className="staged-title staged-pre" ref={titleRef}>
            Welcome to {brandName}
          </h1>
          <input
            className="staged-field staged-pre"
            ref={passRef}
            type="password"
            placeholder="Password"
            aria-label="Operator password"
            autoComplete="current-password"
          />
          <button className="staged-enter staged-pre" ref={enterRef} type="submit">
            Enter
          </button>
          {msg !== null && msg !== '' && (
            <p className="staged-status" role="alert">
              {msg}
            </p>
          )}
          <label className="staged-remember staged-pre" ref={rememberRef}>
            <input ref={boxRef} type="checkbox" />
            <span className="staged-track" aria-hidden="true" />
            <span>Remain in the system</span>
          </label>
        </form>
      </div>
    </main>
  );
}
