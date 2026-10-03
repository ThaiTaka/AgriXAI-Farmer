/**
 * Mounted once while signed in: sets up the notification channels, asks for
 * permission (Android 13+), starts the background sync, loads the cached
 * prices and forecast, keeps the scheduled reminders in step with the
 * farmer's, and routes taps on system notifications. Renders nothing.
 */

import {useEffect} from 'react';

import type TaskHistory from '../db/models/TaskHistory';
import {observeUpcomingReminders} from '../db/repositories/taskHistoryRepository';
import {useObservable} from '../db/useObservable';
import {loadCachedPrices} from '../live/prices';
import {loadCachedForecast} from '../live/weather';
import {startBackgroundSync} from './background';
import {askPermission, ensureChannels, onOpened, openedAtLaunch, scheduleReminders} from './notifier';
import {openNotification} from './openNotification';

export function NotificationCenter({userId}: {userId: string}) {
  useEffect(() => {
    loadCachedPrices();
    loadCachedForecast();
    ensureChannels().then(() => askPermission());
    startBackgroundSync();
  }, [userId]);

  const reminders = useObservable<TaskHistory[]>(() => observeUpcomingReminders(userId), [userId], []);
  useEffect(() => {
    scheduleReminders(
      reminders.map(r => ({
        id: r.id,
        taskTitle: r.taskTitle,
        remindAt: r.remindAt,
        done: r.done,
        plotId: r.plotId,
        protocolId: r.protocolId,
      })),
    ).catch(error => console.warn('[notify] reminders failed', error));
  }, [reminders]);

  useEffect(() => {
    let alive = true;
    openedAtLaunch().then(data => {
      if (alive && data) openNotification(data, userId);
    });
    const unsubscribe = onOpened(data => openNotification(data, userId));
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [userId]);

  return null;
}
