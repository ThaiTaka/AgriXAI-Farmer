import type {DependencyList} from 'react';
import {useEffect, useState} from 'react';
import type {Observable} from 'rxjs';

/**
 * Subscribes to a WatermelonDB observable query and re-renders on every change.
 *
 * This is what makes Điều 1 hold in practice: screens render from the local
 * database, so a write that happened while offline shows up immediately and the
 * later sync just produces another emission. No screen ever renders from an
 * HTTP response.
 */
export function useObservable<T>(
  factory: () => Observable<T>,
  deps: DependencyList,
  initial: T,
): T {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    const subscription = factory().subscribe({
      next: setValue,
      error: error => console.warn('[db] observable failed', error),
    });
    return () => subscription.unsubscribe();
    // `factory` is intentionally not a dependency — callers pass an inline
    // closure, and the explicit deps list is what controls resubscription.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return value;
}
