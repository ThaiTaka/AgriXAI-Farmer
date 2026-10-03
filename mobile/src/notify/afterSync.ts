/**
 * Everything that follows a successful sync, none of it on a screen's path:
 *
 *   * each new message (admin, weather warning, price change) rings the phone
 *     once — not the history a first sync brings, not one already expired;
 *   * when the farmer's offline work reaches the server while the app is in
 *     the background, a quiet "đã đồng bộ" notification says so (in the
 *     foreground the sync banner says it);
 *   * the admin's prices and the village forecast are refreshed when stale —
 *     at once when a price or weather message just arrived.
 *
 * Never throws: a failure here must not turn a good sync into an error.
 */

import {AppState} from 'react-native';

import type {SyncOutcome} from '../api/sync';
import type {NoticeLike} from '../domain/notifications';
import {shouldRing} from '../domain/notifications';
import {summaryLine} from '../domain/syncSummary';
import {refreshPrices} from '../live/prices';
import {refreshForecast} from '../live/weather';
import {dismissNotice, showNotice, showSynced} from './notifier';

/** Ids already raised in this run of the app. The foreground timer and the
 * background job can share one sync pass; the phone still rings once. */
const rung = new Set<string>();

/** A pulled row (snake_case, as the server sends it) as a notice. */
export function noticeFromRow(row: Record<string, unknown>): NoticeLike {
  return {
    id: String(row.id),
    kind: String(row.kind ?? 'announcement'),
    level: String(row.level ?? 'info'),
    title: String(row.title ?? ''),
    body: String(row.body ?? ''),
    link: (row.link as string | null | undefined) ?? null,
    createdAt: Number(row.created_at ?? 0),
    updatedAt: Number(row.updated_at ?? 0),
    expiresAt: row.expires_at == null ? null : Number(row.expires_at),
  };
}

export async function afterSync(outcome: SyncOutcome, token: string, now: number = Date.now()): Promise<void> {
  const summary = outcome.summary;
  if (!outcome.ok || !summary) return;

  const arrived = summary.newNotifications.map(noticeFromRow);
  const ring = arrived.filter(n => !rung.has(n.id) && shouldRing(n, {firstSync: summary.firstSync, now}));
  ring.forEach(n => rung.add(n.id));
  await Promise.all(ring.map(n => showNotice(n).catch(error => console.warn('[notify] show failed', error))));

  // A message the admin took back leaves the shade as well as the inbox.
  await Promise.all((summary.retractedNotifications ?? []).map(id => dismissNotice(id)));

  const line = summaryLine(summary);
  if (line && summary.sent > 0 && AppState.currentState !== 'active') {
    await showSynced(line).catch(error => console.warn('[notify] sync notice failed', error));
  }

  await Promise.all([
    refreshPrices(token, {force: arrived.some(n => n.kind === 'price')}),
    refreshForecast(token, {force: arrived.some(n => n.kind === 'weather')}),
  ]);
}
