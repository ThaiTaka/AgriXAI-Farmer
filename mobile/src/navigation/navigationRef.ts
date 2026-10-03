/**
 * The navigator, reachable from outside a screen — a tapped system
 * notification has to open the right screen whatever is showing, including
 * when the tap is what launched the app and the navigator is not up yet.
 */

import {createNavigationContainerRef} from '@react-navigation/native';

import type {RootStackParamList} from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

let pending: (() => void) | null = null;

/** Runs `action` now, or as soon as the navigator is ready (latest wins). */
export function whenNavigationReady(action: () => void): void {
  if (navigationRef.isReady()) action();
  else pending = action;
}

/** Wired to NavigationContainer's onReady. */
export function flushPendingNavigation(): void {
  const action = pending;
  pending = null;
  action?.();
}
