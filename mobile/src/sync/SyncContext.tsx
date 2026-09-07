import React, {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import {AppState} from 'react-native';

import type {SyncOutcome} from '../api/sync';
import {runSync} from '../api/sync';
import {useAuth} from '../auth/AuthContext';

export type SyncState = 'idle' | 'syncing' | 'offline' | 'error';

interface SyncContextValue {
  state: SyncState;
  lastSyncedAt: number | null;
  sync: () => Promise<SyncOutcome>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

/** How often to retry in the background while the app is open. */
const INTERVAL_MS = 60_000;

/**
 * Runs the sync in the background: on sign-in, whenever the app returns to the
 * foreground, and on a slow timer.
 *
 * Nothing here is on a screen's critical path — the UI reads from SQLite, so a
 * sync that never succeeds only means the farmer's data has not left the phone
 * yet. That is exactly the behaviour Điều 1 asks for.
 */
export function SyncProvider({children}: {children: React.ReactNode}) {
  const {session, signOut} = useAuth();
  const [state, setState] = useState<SyncState>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const token = session?.token ?? null;
  const tokenRef = useRef(token);
  tokenRef.current = token;

  const sync = useCallback(async (): Promise<SyncOutcome> => {
    const current = tokenRef.current;
    if (!current) return {ok: false, reason: 'unauthorised'};

    setState('syncing');
    const outcome = await runSync(current);

    if (outcome.ok) {
      setState('idle');
      setLastSyncedAt(Date.now());
    } else if (outcome.reason === 'offline') {
      setState('offline');
    } else if (outcome.reason === 'unauthorised') {
      // The token expired or was revoked; make the farmer log in again rather
      // than retrying a request that can never succeed.
      setState('error');
      await signOut();
    } else {
      setState('error');
    }

    return outcome;
  }, [signOut]);

  useEffect(() => {
    if (!token) return;

    const fire = () => {
      // A failed sync is never surfaced here — `sync` already records the state
      // and the farmer's data is safe on the device either way.
      sync().catch(() => {});
    };

    fire();
    const timer = setInterval(fire, INTERVAL_MS);
    const subscription = AppState.addEventListener('change', next => {
      if (next === 'active') fire();
    });

    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [token, sync]);

  const value = useMemo<SyncContextValue>(
    () => ({state, lastSyncedAt, sync}),
    [state, lastSyncedAt, sync],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used inside <SyncProvider>');
  return ctx;
}
