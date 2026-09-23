import {Q} from '@nozbe/watermelondb';
import {Platform} from 'react-native';

import type {ErrorRecord} from '../../domain/errorLog';
import {APP_VERSION} from '../../utils/version';
import {collections, database} from '..';
import type ErrorLogEntry from '../models/ErrorLogEntry';

export {APP_VERSION};

/** Saves a caught error locally. Never throws — a failing logger inside an error boundary would hide the real error. */
export async function recordError(record: ErrorRecord, userId: string, reported = false): Promise<ErrorLogEntry | null> {
  try {
    let created!: ErrorLogEntry;
    await database.write(async () => {
      created = collections.errorLogs.prepareCreate(row => {
        row.action = record.action;
        row.message = record.message;
        row.stack = record.stack;
        row.appVersion = APP_VERSION;
        row.platform = Platform.OS;
        row.occurredAt = record.occurredAt;
        row.reported = reported;
        row.uploadedAt = null;
        row.userId = userId;
      });
      await database.batch(created);
    });
    return created;
  } catch (error) {
    console.warn('[errors] could not record error', error);
    return null;
  }
}

export async function markReported(entry: ErrorLogEntry): Promise<void> {
  await database.write(async () => {
    await database.batch(
      entry.prepareUpdate(r => {
        r.reported = true;
      }),
    );
  });
}

export async function pendingUploads(userId: string): Promise<ErrorLogEntry[]> {
  return collections.errorLogs
    .query(Q.where('user_id', userId), Q.where('uploaded_at', null), Q.sortBy('occurred_at', Q.asc))
    .fetch();
}

export async function markUploaded(entries: readonly ErrorLogEntry[], at: number): Promise<void> {
  if (entries.length === 0) return;
  await database.write(async () => {
    await database.batch(
      ...entries.map(e =>
        e.prepareUpdate(r => {
          r.uploadedAt = at;
        }),
      ),
    );
  });
}

export function observeErrorLogs(userId: string) {
  return collections.errorLogs
    .query(Q.where('user_id', userId), Q.sortBy('occurred_at', Q.desc))
    .observeWithColumns(['uploaded_at', 'reported']);
}

export async function clearUploadedLogs(userId: string): Promise<number> {
  const rows = await collections.errorLogs.query(Q.where('user_id', userId), Q.where('uploaded_at', Q.notEq(null))).fetch();
  await database.write(async () => {
    await database.batch(...rows.map(r => r.prepareDestroyPermanently()));
  });
  return rows.length;
}
