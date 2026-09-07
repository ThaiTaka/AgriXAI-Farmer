/**
 * Local SQLite schema (WatermelonDB).
 *
 * Every synced table carries:
 *   - `updated_by`  : who last touched the record (drives the change log)
 *   - `created_at` / `updated_at` : epoch milliseconds, matching the backend
 *
 * There is deliberately no `server_id`. WatermelonDB generates the record id on
 * the device and the server stores that same id, so a row created offline keeps
 * one identity everywhere — a second server-side key would only be another thing
 * to keep in step.
 *
 * WatermelonDB adds `_status` and `_changed` columns itself; those are what the
 * sync adapter uses to work out what to push. Deletions are recorded by
 * WatermelonDB in its own `_raw` bookkeeping, so no `deleted_at` column here.
 *
 * Synced tables must match app/models/farm.py on the server — enforced by
 * backend/tests/test_schema_parity.py.
 */

import {appSchema, tableSchema} from '@nozbe/watermelondb';

export const SCHEMA_VERSION = 3;

export const schema = appSchema({
  version: SCHEMA_VERSION,
  tables: [
    tableSchema({
      name: 'plots',
      columns: [
        {name: 'code', type: 'string', isIndexed: true},
        {name: 'name', type: 'string'},
        {name: 'region', type: 'string', isOptional: true},
        {name: 'area', type: 'number'},
        {name: 'area_unit', type: 'string'},
        {name: 'crop_type', type: 'string'},
        {name: 'variety_id', type: 'string', isOptional: true, isIndexed: true},
        {name: 'variety_name', type: 'string', isOptional: true},
        {name: 'planted_at', type: 'number', isOptional: true},
        {name: 'status', type: 'string'},
        {name: 'notes', type: 'string', isOptional: true},
        {name: 'owner_id', type: 'string', isIndexed: true},
        {name: 'updated_by', type: 'string', isOptional: true},
        {name: 'created_at', type: 'number'},
        {name: 'updated_at', type: 'number'},
      ],
    }),

    tableSchema({
      name: 'crop_varieties',
      columns: [
        {name: 'seed_key', type: 'string', isOptional: true, isIndexed: true},
        {name: 'name', type: 'string'},
        {name: 'crop_type', type: 'string', isIndexed: true},
        {name: 'crop_name', type: 'string'},
        {name: 'fruit', type: 'string', isOptional: true},
        {name: 'usage', type: 'string', isOptional: true},
        {name: 'note', type: 'string', isOptional: true},
        {name: 'is_seed', type: 'boolean'},
        {name: 'approved', type: 'boolean'},
        {name: 'source', type: 'string'},
        {name: 'created_by', type: 'string', isOptional: true},
        {name: 'created_at', type: 'number'},
        {name: 'updated_at', type: 'number'},
      ],
    }),

    tableSchema({
      name: 'crop_cycles',
      columns: [
        {name: 'plot_id', type: 'string', isIndexed: true},
        {name: 'name', type: 'string'},
        {name: 'crop_type', type: 'string'},
        {name: 'variety_id', type: 'string', isOptional: true},
        {name: 'variety_name', type: 'string', isOptional: true},
        {name: 'stage', type: 'string'},
        {name: 'started_at', type: 'number'},
        {name: 'ended_at', type: 'number', isOptional: true},
        {name: 'yield_kg', type: 'number', isOptional: true},
        {name: 'notes', type: 'string', isOptional: true},
        {name: 'owner_id', type: 'string', isIndexed: true},
        {name: 'updated_by', type: 'string', isOptional: true},
        {name: 'created_at', type: 'number'},
        {name: 'updated_at', type: 'number'},
      ],
    }),

    tableSchema({
      name: 'change_logs',
      columns: [
        {name: 'table_name', type: 'string', isIndexed: true},
        {name: 'record_id', type: 'string', isIndexed: true},
        {name: 'action', type: 'string'},
        {name: 'field', type: 'string', isOptional: true},
        {name: 'old_value', type: 'string', isOptional: true},
        {name: 'new_value', type: 'string', isOptional: true},
        {name: 'changed_by', type: 'string'},
        {name: 'changed_by_name', type: 'string', isOptional: true},
        {name: 'changed_at', type: 'number', isIndexed: true},
        {name: 'created_at', type: 'number'},
        {name: 'updated_at', type: 'number'},
      ],
    }),
  ],
});

/** Tables the two-way sync covers. */
export const SYNC_TABLES = [
  'plots',
  'crop_varieties',
  'crop_cycles',
  'change_logs',
] as const;

/** Tables that stay on the device and have no server counterpart. */
export const LOCAL_ONLY_TABLES = [] as const;

export type SyncTable = (typeof SYNC_TABLES)[number];
