import React, {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import {AppState} from 'react-native';

import {uploadErrorLogs} from '../api/logs';
import type {SyncConflict, SyncOutcome} from '../api/sync';
import {runSync} from '../api/sync';
import {useAuth} from '../auth/AuthContext';
import type {TableSyncInfo} from '../domain/syncStatus';
import {keepLocalVersion, takeServerVersion} from './conflicts';
import {pendingByTable} from './pending';

export type SyncState = 'idle' | 'syncing' | 'offline' | 'error';

interface SyncContextValue {
  state: SyncState;
  lastSyncedAt: number | null;
  sync: () => Promise<SyncOutcome>;
  /** Rows the server refused on the last push, awaiting the farmer's choice. */
  conflicts: SyncConflict[];
  resolveConflict: (conflict: SyncConflict, choice: 'mine' | 'theirs') => Promise<void>;
  /** Unsent changes per table (refreshed after every sync and on demand). */
  pending: TableSyncInfo[];
  refreshPending: () => Promise<void>;
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
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [pending, setPending] = useState<TableSyncInfo[]>([]);
  const token = session?.token ?? null;
  const userId = session?.user.id ?? null;
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const userRef = useRef(userId);
  userRef.current = userId;

  const refreshPending = useCallback(async () => {
    try {
      setPending(await pendingByTable());
    } catch (error) {
      console.warn('[sync] pending refresh failed', error);
    }
  }, []);

  const sync = useCallback(async (): Promise<SyncOutcome> => {
    const current = tokenRef.current;
    if (!current) return {ok: false, reason: 'unauthorised'};

    setState('syncing');
    const outcome = await runSync(current);

    if (outcome.ok) {
      setState('idle');
      setLastSyncedAt(Date.now());
      if (outcome.conflicts && outcome.conflicts.length > 0) {
        setConflicts(prev => {
          const seen = new Set(prev.map(c => `${c.table}/${c.id}`));
          return [...prev, ...outcome.conflicts!.filter(c => !seen.has(`${c.table}/${c.id}`))];
        });
      }
      // Online for sure: drain the error-log queue too. Never fatal.
      if (userRef.current) {
        uploadErrorLogs(current, userRef.current).catch(error => console.warn('[logs] upload failed', error));
      }
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

    await refreshPending();
    return outcome;
  }, [signOut, refreshPending]);

  const resolveConflict = useCallback(
    async (conflict: SyncConflict, choice: 'mine' | 'theirs') => {
      if (choice === 'theirs') await takeServerVersion(conflict);
      else await keepLocalVersion(conflict, userRef.current ?? 'device');
      setConflicts(prev => prev.filter(c => !(c.table === conflict.table && c.id === conflict.id)));
      // Push the decision straight away; if offline it goes with the next pass.
      sync().catch(() => {});
    },
    [sync],
  );

  useEffect(() => {
    if (!token) {
      setConflicts([]);
      setPending([]);
      return;
    }

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
    () => ({state, lastSyncedAt, sync, conflicts, resolveConflict, pending, refreshPending}),
    [state, lastSyncedAt, sync, conflicts, resolveConflict, pending, refreshPending],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used inside <SyncProvider>');
  return ctx;
}
