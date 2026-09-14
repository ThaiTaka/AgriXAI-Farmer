/**
 * Uploads queued error logs (POST /logs). Called after a successful sync so
 * it only runs when the phone is demonstrably online; ids are reused so a
 * retry after a dropped response cannot create duplicates.
 */

import type ErrorLogEntry from '../db/models/ErrorLogEntry';
import {markUploaded, pendingUploads} from '../db/repositories/errorLogRepository';
import {request} from './client';

export async function uploadErrorLogs(token: string, userId: string): Promise<number> {
  const pending = await pendingUploads(userId);
  if (pending.length === 0) return 0;
  const accepted = await postLogs(token, pending);
  const done = pending.filter(p => accepted.includes(p.id));
  await markUploaded(done, Date.now());
  return done.length;
}

export async function postLogs(token: string, entries: readonly ErrorLogEntry[]): Promise<string[]> {
  const body = entries.map(e => ({
    id: e.id,
    action: e.action,
    message: e.message,
    stack: e.stack,
    app_version: e.appVersion,
    platform: e.platform,
    occurred_at: e.occurredAt,
    reported: e.reported,
  }));
  const result = await request<{accepted: string[]}>('/logs', {method: 'POST', body, token});
  return result.accepted;
}
