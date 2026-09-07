/**
 * WatermelonDB sync adapter (Mục 9).
 *
 * Two-way from the start: `pullChanges` fetches what the server has, and
 * `pushChanges` sends everything the local `_status` bookkeeping marks as
 * unsynced. The sync NEVER blocks a screen — callers fire it and ignore the
 * outcome; a failure just means the next attempt will carry the same rows.
 */

import {synchronize} from '@nozbe/watermelondb/sync';

import {database} from '../db';
import {SCHEMA_VERSION} from '../db/schema';
import {API_BASE_URL, NetworkError} from './client';

export interface SyncOutcome {
  ok: boolean;
  reason?: 'offline' | 'unauthorised' | 'error';
  detail?: string;
}

let inFlight: Promise<SyncOutcome> | null = null;

/**
 * Runs one sync pass.
 *
 * Calls are collapsed: if a sync is already running, the caller joins it rather
 * than starting a second one. Two overlapping passes would push the same rows
 * twice and race on `last_pulled_at`.
 */
export async function runSync(token: string): Promise<SyncOutcome> {
  if (inFlight) return inFlight;

  inFlight = (async (): Promise<SyncOutcome> => {
    try {
      await synchronize({
        database,
        pullChanges: async ({lastPulledAt, schemaVersion, migration}) => {
          // Built by hand: React Native's URLSearchParams polyfill does not
          // implement `set`, so using it here fails only at runtime.
          const params = [`schema_version=${schemaVersion ?? SCHEMA_VERSION}`];
          if (lastPulledAt) params.push(`last_pulled_at=${lastPulledAt}`);
          if (migration) {
            params.push(`migration=${encodeURIComponent(JSON.stringify(migration))}`);
          }

          const response = await fetch(`${API_BASE_URL}/sync?${params.join('&')}`, {
            headers: {Authorization: `Bearer ${token}`},
          });
          if (response.status === 401) throw new UnauthorisedError();
          if (!response.ok) throw new Error(`pull failed: ${response.status}`);

          const body = await response.json();
          return {changes: body.changes, timestamp: body.timestamp};
        },
        pushChanges: async ({changes, lastPulledAt}) => {
          const response = await fetch(
            `${API_BASE_URL}/sync?last_pulled_at=${lastPulledAt}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(changes),
            },
          );
          if (response.status === 401) throw new UnauthorisedError();
          if (!response.ok) throw new Error(`push failed: ${response.status}`);
        },
        // Deliberately NOT setting `sendCreatedAsUpdated`: that flag is for
        // servers which cannot tell a create from an update, and WatermelonDB
        // rejects a response containing `created` when it is on. Ours reports
        // the two separately.
        log: __DEV__ ? {} : undefined,
      });

      return {ok: true};
    } catch (error) {
      if (error instanceof UnauthorisedError) {
        return {ok: false, reason: 'unauthorised'};
      }
      if (error instanceof NetworkError || isNetworkFailure(error)) {
        // Being offline is the normal case out in a field, not an error worth
        // showing the farmer.
        return {ok: false, reason: 'offline'};
      }
      console.warn('[sync] failed', error);
      return {ok: false, reason: 'error', detail: String(error)};
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

class UnauthorisedError extends Error {
  constructor() {
    super('unauthorised');
    this.name = 'UnauthorisedError';
  }
}

function isNetworkFailure(error: unknown): boolean {
  return error instanceof TypeError && /network|fetch|connect/i.test(error.message);
}
