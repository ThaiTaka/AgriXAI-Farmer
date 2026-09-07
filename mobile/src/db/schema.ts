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
 * backend/tests/test_schema_parity.py. `pending_diagnoses` is the exception: it
 * is a LOCAL-ONLY upload queue with no server counterpart (see LOCAL_ONLY_TABLES).
 */

import {appSchema, tableSchema} from '@nozbe/watermelondb';

export const SCHEMA_VERSION = 2;

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
      name: 'diagnoses',
      columns: [
        {name: 'plot_id', type: 'string', isIndexed: true},
        {name: 'disease_key', type: 'string'},
        {name: 'disease_name', type: 'string'},
        {name: 'severity', type: 'string', isIndexed: true},
        {name: 'confidence', type: 'number'},
        {name: 'affected_ratio', type: 'number', isOptional: true},
        {name: 'image_path', type: 'string', isOptional: true},
        {name: 'model_version', type: 'string', isOptional: true},
        {name: 'explanation', type: 'string', isOptional: true},
        {name: 'top3_json', type: 'string', isOptional: true},
        {name: 'heatmap_json', type: 'string', isOptional: true},
        {name: 'queued', type: 'boolean'},
        {name: 'diagnosed_at', type: 'number', isIndexed: true},
        {name: 'owner_id', type: 'string', isIndexed: true},
        {name: 'updated_by', type: 'string', isOptional: true},
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

    /**
     * LOCAL ONLY — the photo upload queue (Điều 3).
     *
     * A photo taken with no signal lands here instead of failing. The queue
     * processor drains it once the network is back. Rows never leave the device:
     * the file path is meaningless anywhere else, and the diagnosis the upload
     * produces is what actually syncs.
     */
    tableSchema({
      name: 'pending_diagnoses',
      columns: [
        {name: 'photo_path', type: 'string'},
        {name: 'photo_mime', type: 'string'},
        {name: 'plot_id', type: 'string', isIndexed: true},
        {name: 'status', type: 'string', isIndexed: true},
        {name: 'attempts', type: 'number'},
        {name: 'last_error', type: 'string', isOptional: true},
        {name: 'diagnosis_id', type: 'string', isOptional: true},
        {name: 'owner_id', type: 'string', isIndexed: true},
        {name: 'synced_at', type: 'number', isOptional: true},
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
  'diagnoses',
  'crop_cycles',
  'change_logs',
] as const;

/** Tables that stay on the device and have no server counterpart. */
export const LOCAL_ONLY_TABLES = ['pending_diagnoses'] as const;

export type SyncTable = (typeof SYNC_TABLES)[number];
