/**
 * The local database.
 *
 * Điều 1 (ghi cục bộ trước): every create/update/delete commits here first and
 * the UI re-renders from observable queries — never from an HTTP response. The
 * network is a background concern handled by the sync adapter.
 *
 * `jsi: false` keeps WatermelonDB on the async bridge adapter. The JSI adapter
 * is faster but needs extra native wiring per architecture; the bridge works
 * everywhere and the record counts a smallholding produces are tiny. See
 * docs/adr/0002-giai-doan-1.md.
 */

import {Database} from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

import {migrations} from './migrations';
import {ChangeLog, CropCycle, CropVariety, Diagnosis, Plot} from './models';
import {schema} from './schema';

const adapter = new SQLiteAdapter({
  schema,
  migrations,
  jsi: false,
  dbName: 'agrilog',
  onSetUpError: error => {
    // Surfacing this matters: a failed setup means the farmer would silently
    // lose everything they type. Better a loud log than quiet data loss.
    console.error('[db] WatermelonDB setup failed', error);
  },
});

export const database = new Database({
  adapter,
  modelClasses: [Plot, CropVariety, Diagnosis, CropCycle, ChangeLog],
});

export const collections = {
  plots: database.get<Plot>('plots'),
  cropVarieties: database.get<CropVariety>('crop_varieties'),
  diagnoses: database.get<Diagnosis>('diagnoses'),
  cropCycles: database.get<CropCycle>('crop_cycles'),
  changeLogs: database.get<ChangeLog>('change_logs'),
};

export {schema, SCHEMA_VERSION, SYNC_TABLES} from './schema';
export * from './models';
