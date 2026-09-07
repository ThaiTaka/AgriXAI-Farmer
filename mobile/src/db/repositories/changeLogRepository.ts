import {Q} from '@nozbe/watermelondb';

import {collections, database} from '..';
import type ChangeLog from '../models/ChangeLog';
import type {ChangeAction} from '../models/ChangeLog';

export interface ChangeAuthor {
  id: string;
  name: string;
}

export interface FieldChange {
  field: string;
  /** Human-readable label shown in the "Lịch sử thay đổi" tab. */
  label: string;
  oldValue: string | null;
  newValue: string | null;
}

/**
 * Appends audit rows. Always call inside the SAME `database.write()` block as
 * the change itself — a log written in a separate transaction can survive a
 * change that got rolled back, which is worse than no log at all.
 */
export function prepareChangeLogs(
  tableName: string,
  recordId: string,
  action: ChangeAction,
  author: ChangeAuthor,
  changes: FieldChange[],
): ChangeLog[] {
  const changedAt = Date.now();
  const rows = changes.length > 0 ? changes : [{field: null, label: null, oldValue: null, newValue: null}];

  return rows.map(change =>
    collections.changeLogs.prepareCreate(log => {
      log.tableName = tableName;
      log.recordId = recordId;
      log.action = action;
      log.fieldName = 'field' in change ? (change.field as string | null) : null;
      log.oldValue = change.oldValue ?? null;
      log.newValue = change.newValue ?? null;
      log.changedBy = author.id;
      log.changedByName = author.name;
      log.changedAt = changedAt;
    }),
  );
}

export function observeChangeLogs(tableName: string, recordId: string) {
  return collections.changeLogs
    .query(
      Q.where('table_name', tableName),
      Q.where('record_id', recordId),
      Q.sortBy('changed_at', Q.desc),
    )
    .observeWithColumns(['changed_at']);
}

/** Only used by tests and the dev reset helper. */
export async function clearChangeLogs(): Promise<void> {
  await database.write(async () => {
    const all = await collections.changeLogs.query().fetch();
    await Promise.all(all.map(row => row.destroyPermanently()));
  });
}
