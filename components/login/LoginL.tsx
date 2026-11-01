'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { OsMark, Pressable } from '@/components/legacy';

/**
 * /login under Bennett Legacy: NoPasswordL is the no-password side of the
 * page — configured sign-ins render the Stated welcome (components/staged/
 * StagedAuth.tsx) instead of this card.
 */
function Frame({ brandName, title, children }: { brandName: string; title: string; children: ReactNode }) {
  const [host, setHost] = useState('');
  useEffect(() => setHost(window.location.host), []);
  return (
    <main data-l="Login" className="l-login">
      <div className="l-login-head l-rise">
        <OsMark size={40} />
        <div className="l-eyebrow">{'// OPERATOR CONSOLE'}</div>
        <h1 className="l-login-title">{title}</h1>
      </div>
      <section data-l="SlabCard" className="l-card l-login-card l-rise" aria-label={`${brandName} sign in`}>
        {children}
      </section>
      <p className="l-login-foot">
        {brandName}
        {host ? ` · ${host}` : ''}
      </p>
    </main>
  );
}

export function NoPasswordL({ brandName }: { brandName: string }) {
  return (
    <Frame brandName={brandName} title="No password is set">
      <p className="l-login-note">Nothing is locked, so there is nothing to sign in to. Open the console directly, or set an operator password under Settings to turn sign-in on.</p>
      <div className="l-login-actions">
        <Pressable tone="primary" href="/">
          Open {brandName}
        </Pressable>
        <Pressable tone="secondary" href="/setup#security">
          Set a password
        </Pressable>
      </div>
    </Frame>
  );
}
