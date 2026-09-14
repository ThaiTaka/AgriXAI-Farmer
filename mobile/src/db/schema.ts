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

export const SCHEMA_VERSION = 6;

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
        {name: 'crop_name', type: 'string', isOptional: true},
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

    // Three-level catalogue: crop_type -> category -> variety. Crop types and
    // categories are static (shared/data/crop_varieties.json); only the
    // varieties are rows, because that is the level farmers add to.
    tableSchema({
      name: 'crop_varieties',
      columns: [
        {name: 'seed_key', type: 'string', isOptional: true, isIndexed: true},
        {name: 'name', type: 'string'},
        {name: 'crop_type', type: 'string', isIndexed: true},
        {name: 'crop_name', type: 'string'},
        {name: 'category_id', type: 'string', isOptional: true, isIndexed: true},
        {name: 'category_name', type: 'string', isOptional: true},
        {name: 'description', type: 'string', isOptional: true},
        {name: 'usage', type: 'string', isOptional: true},
        {name: 'growing_note', type: 'string', isOptional: true},
        {name: 'badge', type: 'string', isOptional: true},
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

    // ---- Giai đoạn 3: plans, stock ledger, income/expense, care history ----
    // Column-for-column mirrors of app/models/ledger.py on the server.
    // `occurred_at` is the business date the farmer typed; `created_at` is
    // when the row was written — a purchase entered on Friday for Tuesday's
    // delivery belongs in Tuesday's report.

    tableSchema({
      name: 'plans',
      columns: [
        {name: 'plot_id', type: 'string', isOptional: true, isIndexed: true},
        {name: 'crop_type', type: 'string'},
        {name: 'crop_name', type: 'string', isOptional: true},
        {name: 'category_id', type: 'string', isOptional: true},
        {name: 'variety_id', type: 'string', isOptional: true},
        {name: 'variety_name', type: 'string', isOptional: true},
        {name: 'protocol_id', type: 'string'},
        {name: 'scenario_id', type: 'string'},
        {name: 'scenario_name', type: 'string'},
        {name: 'area_input', type: 'number'},
        {name: 'area_unit', type: 'string'},
        {name: 'area_m2', type: 'number'},
        {name: 'items_json', type: 'string'},
        {name: 'cost_min', type: 'number', isOptional: true},
        {name: 'cost_max', type: 'number', isOptional: true},
        {name: 'note', type: 'string', isOptional: true},
        {name: 'owner_id', type: 'string', isIndexed: true},
        {name: 'updated_by', type: 'string', isOptional: true},
        {name: 'created_at', type: 'number'},
        {name: 'updated_at', type: 'number'},
      ],
    }),

    tableSchema({
      name: 'warehouse_in',
      columns: [
        {name: 'fertilizer_id', type: 'string', isIndexed: true},
        {name: 'fertilizer_name', type: 'string'},
        {name: 'category', type: 'string', isOptional: true},
        {name: 'quantity', type: 'number'},
        {name: 'unit', type: 'string'},
        {name: 'quantity_kg', type: 'number'},
        {name: 'price', type: 'number'},
        {name: 'unit_price', type: 'number'},
        {name: 'occurred_at', type: 'number', isIndexed: true},
        {name: 'note', type: 'string', isOptional: true},
        {name: 'plot_id', type: 'string', isOptional: true},
        {name: 'expense_id', type: 'string', isOptional: true},
        {name: 'owner_id', type: 'string', isIndexed: true},
        {name: 'updated_by', type: 'string', isOptional: true},
        {name: 'created_at', type: 'number'},
        {name: 'updated_at', type: 'number'},
      ],
    }),

    tableSchema({
      name: 'warehouse_out',
      columns: [
        {name: 'fertilizer_id', type: 'string', isIndexed: true},
        {name: 'fertilizer_name', type: 'string'},
        {name: 'category', type: 'string', isOptional: true},
        {name: 'quantity_kg', type: 'number'},
        {name: 'unit_price', type: 'number'},
        {name: 'total_cost', type: 'number'},
        {name: 'occurred_at', type: 'number', isIndexed: true},
        {name: 'note', type: 'string', isOptional: true},
        {name: 'plot_id', type: 'string', isOptional: true},
        {name: 'plan_id', type: 'string', isOptional: true},
        {name: 'owner_id', type: 'string', isIndexed: true},
        {name: 'updated_by', type: 'string', isOptional: true},
        {name: 'created_at', type: 'number'},
        {name: 'updated_at', type: 'number'},
      ],
    }),

    tableSchema({
      name: 'income',
      columns: [
        {name: 'kind', type: 'string'},
        {name: 'description', type: 'string'},
        {name: 'amount', type: 'number'},
        {name: 'occurred_at', type: 'number', isIndexed: true},
        {name: 'note', type: 'string', isOptional: true},
        {name: 'plot_id', type: 'string', isOptional: true},
        {name: 'checked', type: 'boolean'},
        {name: 'owner_id', type: 'string', isIndexed: true},
        {name: 'updated_by', type: 'string', isOptional: true},
        {name: 'created_at', type: 'number'},
        {name: 'updated_at', type: 'number'},
      ],
    }),

    tableSchema({
      name: 'expense',
      columns: [
        {name: 'kind', type: 'string'},
        {name: 'description', type: 'string'},
        {name: 'amount', type: 'number'},
        {name: 'occurred_at', type: 'number', isIndexed: true},
        {name: 'note', type: 'string', isOptional: true},
        {name: 'plot_id', type: 'string', isOptional: true},
        {name: 'checked', type: 'boolean'},
        {name: 'warehouse_in_id', type: 'string', isOptional: true},
        {name: 'owner_id', type: 'string', isIndexed: true},
        {name: 'updated_by', type: 'string', isOptional: true},
        {name: 'created_at', type: 'number'},
        {name: 'updated_at', type: 'number'},
      ],
    }),

    tableSchema({
      name: 'tasks_history',
      columns: [
        {name: 'protocol_id', type: 'string', isIndexed: true},
        {name: 'stage_code', type: 'string'},
        {name: 'task_key', type: 'string'},
        {name: 'task_title', type: 'string'},
        {name: 'crop_type', type: 'string'},
        {name: 'plot_id', type: 'string', isOptional: true, isIndexed: true},
        {name: 'done', type: 'boolean'},
        {name: 'done_at', type: 'number', isOptional: true},
        {name: 'remind_at', type: 'number', isOptional: true},
        {name: 'note', type: 'string', isOptional: true},
        {name: 'owner_id', type: 'string', isIndexed: true},
        {name: 'updated_by', type: 'string', isOptional: true},
        {name: 'created_at', type: 'number'},
        {name: 'updated_at', type: 'number'},
      ],
    }),

    // ---- Giai đoạn 4: local-only error log ----
    // Written by the screen error boundary, uploaded to POST /logs when the
    // phone is online, never pulled back. Not part of the sync protocol, so
    // it is listed in LOCAL_ONLY_TABLES and excluded from the parity test.
    tableSchema({
      name: 'error_logs',
      columns: [
        {name: 'action', type: 'string'},
        {name: 'message', type: 'string'},
        {name: 'stack', type: 'string', isOptional: true},
        {name: 'app_version', type: 'string', isOptional: true},
        {name: 'platform', type: 'string', isOptional: true},
        {name: 'occurred_at', type: 'number', isIndexed: true},
        {name: 'reported', type: 'boolean'},
        {name: 'uploaded_at', type: 'number', isOptional: true},
        {name: 'user_id', type: 'string', isIndexed: true},
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
  'plans',
  'warehouse_in',
  'warehouse_out',
  'income',
  'expense',
  'tasks_history',
] as const;

/** Tables that stay on the device and have no server counterpart. */
export const LOCAL_ONLY_TABLES = ['error_logs'] as const;

export type SyncTable = (typeof SYNC_TABLES)[number];
