import React, {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';

import {login as loginRequest} from '../api/auth';
import type {StoredSession} from './tokenStore';
import {clearSession, loadSession, saveSession} from './tokenStore';

interface AuthState {
  status: 'loading' | 'signedIn' | 'signedOut';
  session: StoredSession | null;
  signIn: (identifier: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({children}: {children: React.ReactNode}) {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [status, setStatus] = useState<AuthState['status']>('loading');

  useEffect(() => {
    let alive = true;
    (async () => {
      const restored = await loadSession();
      if (!alive) return;
      setSession(restored);
      setStatus(restored ? 'signedIn' : 'signedOut');
    })();
    return () => {
      alive = false;
    };
  }, []);

  const signIn = useCallback(async (identifier: string, password: string) => {
    const next = await loginRequest(identifier, password);
    await saveSession(next);
    setSession(next);
    setStatus('signedIn');
  }, []);

  const signOut = useCallback(async () => {
    await clearSession();
    setSession(null);
    setStatus('signedOut');
  }, []);

  const value = useMemo<AuthState>(
    () => ({status, session, signIn, signOut}),
    [status, session, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** The signed-in user, for screens that only render when signed in. */
export function useCurrentUser() {
  const {session} = useAuth();
  if (!session) throw new Error('useCurrentUser called while signed out');
  return session.user;
}

/** Shape the change log expects. */
export function useChangeAuthor() {
  const user = useCurrentUser();
  return useMemo(() => ({id: user.id, name: user.fullName || user.username}), [user]);
}
