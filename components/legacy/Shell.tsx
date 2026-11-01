'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BRAND } from '@/lib/brand';
import { OsMark } from './Marks';

/**
 * The FounderOS shell pieces the GladOS sidebar wears under Bennett Legacy
 * (FO chrome/Sidebar.svelte, SCAFFOLD §3.2). Only rendered when
 * data-ui='legacy', so GladOS and Classic keep their own DOM. The brand comes
 * from BRAND, never a hard-coded product name (SPEC AC-15).
 */

/** Logo lockup: the mark, the product name, the operator subtitle. The rail shows the mark only (CSS). */
export function LegacySideHead() {
  return (
    <Link href="/" className="l-side-lockup" data-l="SideLockup" title={BRAND.name}>
      <OsMark size={34} className="l-side-mark" />
      <span className="l-side-word">
        <span className="l-side-name">{BRAND.name}</span>
        <span className="l-side-sub">Operator mode</span>
      </span>
    </Link>
  );
}

type Live = { up: number; total: number };

/**
 * Footer status strip: "ACTIVE n out of n" from the shared connector board
 * (GET /api/connections/summary), then the registered company (GET /api/company;
 * the host when no company is known). Until the counts arrive it shows a dash,
 * never a made-up number; the green says "every system live", nothing more.
 */
export function LegacySideFoot() {
  const router = useRouter();
  const [live, setLive] = useState<Live | null>(null);
  const [company, setCompany] = useState<string | null>(null);
  const [host, setHost] = useState<string | null>(null);
  // Sign out: ends the session server-side (the cookie is cleared by
  // POST /api/auth/logout) and returns to the welcome screen. It says what
  // happened only, which is all a footer control should ever have to say.
  const [out, setOut] = useState<'idle' | 'busy' | 'error'>('idle');
  const signOut = async () => {
    if (out === 'busy') return;
    setOut('busy');
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (!res.ok) throw new Error('not ok');
      router.replace('/login');
      router.refresh();
    } catch {
      setOut('error');
    }
  };
  useEffect(() => {
    setHost(window.location.host);
    const ctrl = new AbortController();
    fetch('/api/connections/summary', { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Live | null) => {
        if (d && Number.isFinite(d.up) && Number.isFinite(d.total)) setLive({ up: d.up, total: d.total });
      })
      .catch(() => {
        /* unknown stays a dash */
      });
    fetch('/api/company', { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { company: string | null } | null) => {
        if (d && typeof d.company === 'string' && d.company.trim()) setCompany(d.company.trim());
      })
      .catch(() => {
        /* unknown keeps the host line */
      });
    return () => ctrl.abort();
  }, []);
  // A board with nothing tracked (0 out of 0) is not "active": no green, honest word.
  const allUp = !!live && live.total > 0 && live.up === live.total;
  const someUp = !!live && live.up > 0;
  const label = live
    ? `${allUp ? 'ACTIVE' : someUp ? 'LIVE' : 'DOWN'}: ${live.up} out of ${live.total}`
    : 'Systems live: checking';
  return (
    <div className="l-side-foot" data-l="SideFoot">
      <Link href="/integrations" className={`l-side-live ${allUp ? 'is-all-up' : ''}`} title={label} aria-label={label}>
        <span className="l-side-foot-text">
          {live ? (
            <>
              {allUp ? 'ACTIVE ' : someUp ? 'LIVE ' : 'DOWN '}
              {`${live.up} out of ${live.total}`}
            </>
          ) : (
            '-/- systems live'
          )}
        </span>
      </Link>
      <div className="l-side-host l-side-foot-text">{company ?? host ?? '…'}</div>
      <button
        className={`l-side-out l-side-foot-text${out === 'busy' ? ' is-busy' : ''}`}
        onClick={signOut}
        disabled={out === 'busy'}
        title="End the session and return to the welcome screen"
      >
        {out === 'busy' ? 'Signing out…' : out === 'error' ? 'Could not sign out' : 'Sign out'}
      </button>
    </div>
  );
}

/** The brand mark in the topbar's right corner (FO Topbar). */
export function LegacyTopbarMark() {
  return <OsMark size={26} className="l-top-mark" />;
}
