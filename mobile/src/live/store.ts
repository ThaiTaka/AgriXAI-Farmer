/**
 * A value outside React that screens can follow: the last forecast, the
 * admin's prices. useSyncExternalStore keeps every reader in step without a
 * context provider.
 */

import {useSyncExternalStore} from 'react';

export interface Store<T> {
  get: () => T;
  set: (next: T) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createStore<T>(initial: T): Store<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: next => {
      value = next;
      listeners.forEach(l => l());
    },
    subscribe: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
