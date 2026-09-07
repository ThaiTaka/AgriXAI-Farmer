import React, {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import {AppState} from 'react-native';

import {useAuth} from '../auth/AuthContext';
import type PendingDiagnosis from '../db/models/PendingDiagnosis';
import {observePendingQueue} from '../db/repositories/diagnosisRepository';
import {useObservable} from '../db/useObservable';
import {processQueueOnce, TICK_MS} from './queueProcessor';

interface QueueContextValue {
  /** Photos still waiting to be analysed. */
  queue: PendingDiagnosis[];
  pendingCount: number;
  /** True when the last attempt failed because there was no signal. */
  offline: boolean;
  /** Runs a tick now — used by the "thử lại" affordances. */
  drain: () => Promise<void>;
}

const QueueContext = createContext<QueueContextValue | null>(null);

/**
 * Drives the photo queue.
 *
 * Ticks every 5 seconds while the app is open, plus once whenever it returns to
 * the foreground — a farmer who walked back into signal should not have to wait
 * for the next timer.
 */
export function DiagnosisQueueProvider({children}: {children: React.ReactNode}) {
  const {session} = useAuth();
  const [offline, setOffline] = useState(false);

  const token = session?.token ?? null;
  const userId = session?.user.id ?? null;
  const authorName = session ? session.user.fullName || session.user.username : null;

  const author = useMemo(
    () => (userId ? {id: userId, name: authorName ?? userId} : null),
    [userId, authorName],
  );

  // A query with an owner nobody has simply returns nothing, which is the
  // right answer while signed out — no sentinel row is ever created.
  const queue = useObservable<PendingDiagnosis[]>(
    () => observePendingQueue(userId ?? ''),
    [userId],
    [],
  );

  const tokenRef = useRef(token);
  tokenRef.current = token;
  const authorRef = useRef(author);
  authorRef.current = author;

  const drain = useCallback(async () => {
    const result = await processQueueOnce(tokenRef.current, authorRef.current);
    setOffline(result.offline);
  }, []);

  useEffect(() => {
    if (!token) return;

    const fire = () => {
      // Silence is the contract here — see the note in queueProcessor.ts.
      drain().catch(() => {});
    };

    fire();
    const timer = setInterval(fire, TICK_MS);
    const subscription = AppState.addEventListener('change', next => {
      if (next === 'active') fire();
    });

    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [token, drain]);

  const value = useMemo<QueueContextValue>(
    () => ({queue, pendingCount: queue.length, offline, drain}),
    [queue, offline, drain],
  );

  return <QueueContext.Provider value={value}>{children}</QueueContext.Provider>;
}

export function useDiagnosisQueue(): QueueContextValue {
  const ctx = useContext(QueueContext);
  if (!ctx) throw new Error('useDiagnosisQueue must be used inside <DiagnosisQueueProvider>');
  return ctx;
}
