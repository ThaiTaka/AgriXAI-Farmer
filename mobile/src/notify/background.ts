/**
 * Background sync — how messages reach a phone whose app is closed (V2.2).
 *
 * Android runs one ordinary sync with the stored session roughly every 15
 * minutes (JobScheduler decides; Doze can stretch it), including after the
 * app was swiped away (HeadlessJS) and after a reboot. The farmer's offline
 * work goes up, new messages come down and ring the phone (notify/afterSync).
 *
 * No push service and no Google account are involved, so a rain warning
 * arrives within that interval rather than instantly. Firebase Cloud
 * Messaging would be instant but needs the owner's own Firebase project —
 * see docs/adr/0010-giong-noi-thong-bao-thoi-tiet.md.
 */

import BackgroundFetch from 'react-native-background-fetch';

import {runSync} from '../api/sync';
import {loadSession} from '../auth/tokenStore';
import {afterSync} from './afterSync';

export const INTERVAL_MINUTES = 15;

/** One background pass. Always tells Android it is done, or the job is killed. */
export async function syncInBackground(taskId: string): Promise<void> {
  try {
    const session = await loadSession();
    if (session) {
      const outcome = await runSync(session.token, session.user.id);
      await afterSync(outcome, session.token);
    }
  } catch (error) {
    console.warn('[background] sync failed', error);
  } finally {
    BackgroundFetch.finish(taskId);
  }
}

let configured = false;

/** Called once the farmer is signed in. Signed out, a pass finds no session and does nothing. */
export async function startBackgroundSync(): Promise<void> {
  if (configured) return;
  configured = true;
  try {
    await BackgroundFetch.configure(
      {
        minimumFetchInterval: INTERVAL_MINUTES,
        stopOnTerminate: false,
        startOnBoot: true,
        enableHeadless: true,
        requiredNetworkType: BackgroundFetch.NETWORK_TYPE_ANY,
      },
      taskId => {
        syncInBackground(taskId);
      },
      taskId => BackgroundFetch.finish(taskId),
    );
  } catch (error) {
    configured = false;
    console.warn('[background] configure failed', error);
  }
}

/** Registered in index.js: the same pass, after the app was swiped away. */
export async function headlessTask(event: {taskId: string; timeout: boolean}): Promise<void> {
  if (event.timeout) {
    BackgroundFetch.finish(event.taskId);
    return;
  }
  await syncInBackground(event.taskId);
}
