/**
 * Schema migrations.
 *
 * Every schema change MUST add a step here and bump SCHEMA_VERSION, otherwise an
 * existing install loses its local data on upgrade — which for this app means a
 * farmer losing work they did offline.
 */

import {
  addColumns,
  createTable,
  schemaMigrations,
  unsafeExecuteSql,
} from '@nozbe/watermelondb/Schema/migrations';

export const migrations = schemaMigrations({
  migrations: [
    {
      // v6 -> v7 (V2.1): cultivation history, task notes with media, hired
      // labour, care guides. Additive only — every existing row keeps its
      // data; an old crop cycle simply has no season/area until edited.
      toVersion: 7,
      steps: [
        addColumns({
          table: 'crop_cycles',
          columns: [
            {name: 'crop_name', type: 'string', isOptional: true},
            {name: 'season', type: 'string', isOptional: true},
            {name: 'area_m2', type: 'number', isOptional: true},
            {name: 'media_json', type: 'string', isOptional: true},
          ],
        }),
        addColumns({
          table: 'expense',
          columns: [
            {name: 'task_id', type: 'string', isOptional: true, isIndexed: true},
            {name: 'workers', type: 'number', isOptional: true},
            {name: 'quantity', type: 'number', isOptional: true},
            {name: 'unit', type: 'string', isOptional: true},
            {name: 'unit_price', type: 'number', isOptional: true},
          ],
        }),
        createTable({
          name: 'task_notes',
          columns: [
            {name: 'task_id', type: 'string', isIndexed: true},
            {name: 'plot_id', type: 'string', isOptional: true, isIndexed: true},
            {name: 'note_text', type: 'string'},
            {name: 'media_json', type: 'string', isOptional: true},
            {name: 'occurred_at', type: 'number'},
            {name: 'owner_id', type: 'string', isIndexed: true},
            {name: 'updated_by', type: 'string', isOptional: true},
            {name: 'created_at', type: 'number'},
            {name: 'updated_at', type: 'number'},
          ],
        }),
        createTable({
          name: 'care_guides',
          columns: [
            {name: 'crop_type', type: 'string', isIndexed: true},
            {name: 'stage_code', type: 'string', isOptional: true},
            {name: 'title', type: 'string'},
            {name: 'summary', type: 'string', isOptional: true},
            {name: 'youtube_id', type: 'string', isOptional: true},
            {name: 'steps_json', type: 'string', isOptional: true},
            {name: 'images_json', type: 'string', isOptional: true},
            {name: 'source_name', type: 'string', isOptional: true},
            {name: 'source_url', type: 'string', isOptional: true},
            {name: 'published', type: 'boolean'},
            {name: 'sort_order', type: 'number'},
            {name: 'created_by', type: 'string', isOptional: true},
            {name: 'updated_by', type: 'string', isOptional: true},
            {name: 'created_at', type: 'number'},
            {name: 'updated_at', type: 'number'},
          ],
        }),
      ],
    },
    {
      // v5 -> v6: local-only error log for the screen error boundary.
      toVersion: 6,
      steps: [
        createTable({
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
    },
    {
      // v4 -> v5: Giai đoạn 3 ledgers. Six new tables, nothing changed on the
      // existing ones. Column lists are copied from schema.ts on purpose —
      // a migration must describe the shape at the time it ran, not follow
      // later edits to the live schema.
      toVersion: 5,
      steps: [
        createTable({
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
        createTable({
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
        createTable({
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
        createTable({
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
        createTable({
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
        createTable({
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
      ],
    },
    {
      // v3 -> v4: three-level crop catalogue + flat redesign clean-up.
      //
      //  * crop_varieties gains the category and the three descriptive fields
      //    from the new catalogue shape (description / usage / growing_note).
      //    The old `fruit` and `note` columns stay on disk (SQLite cannot drop
      //    them safely here) but are no longer declared, so they are inert.
      //    Their content is copied across first so a variety a farmer typed in
      //    keeps its description.
      //  * plots gains `crop_name` so a plot is self-describing even for a crop
      //    the farmer added themselves.
      //  * crop ids move from Vietnamese slugs to the catalogue ids
      //    ('ca_chua' -> 'tomato'); the server applies the same rename.
      //  * the two tables left behind by the removed diagnosis feature are
      //    finally dropped (the v3 step could not — it predates our use of
      //    unsafeExecuteSql).
      //
      // No `;` inside string literals below: the native driver splits on it.
      toVersion: 4,
      steps: [
        addColumns({
          table: 'crop_varieties',
          columns: [
            {name: 'category_id', type: 'string', isOptional: true, isIndexed: true},
            {name: 'category_name', type: 'string', isOptional: true},
            {name: 'description', type: 'string', isOptional: true},
            {name: 'growing_note', type: 'string', isOptional: true},
            {name: 'badge', type: 'string', isOptional: true},
          ],
        }),
        addColumns({
          table: 'plots',
          columns: [{name: 'crop_name', type: 'string', isOptional: true}],
        }),
        unsafeExecuteSql(
          [
            "UPDATE crop_varieties SET description = fruit WHERE description IS NULL AND fruit IS NOT NULL",
            "UPDATE crop_varieties SET growing_note = note WHERE growing_note IS NULL AND note IS NOT NULL",
            "UPDATE crop_varieties SET crop_type = 'tomato' WHERE crop_type = 'ca_chua'",
            "UPDATE plots SET crop_type = 'tomato' WHERE crop_type = 'ca_chua'",
            "UPDATE plots SET crop_name = 'Cà chua' WHERE crop_type = 'tomato' AND crop_name IS NULL",
            "UPDATE crop_cycles SET crop_type = 'tomato' WHERE crop_type = 'ca_chua'",
            'DROP TABLE IF EXISTS diagnoses',
            'DROP TABLE IF EXISTS pending_diagnoses',
          ].join(';\n') + ';',
        ),
      ],
    },
    {
      // v2 -> v3: diagnosis feature removed from the schema (tables left inert).
      toVersion: 3,
      steps: [],
    },
    {
      // v1 -> v2: image diagnosis (Giai đoạn 2) — kept for the upgrade path.
      toVersion: 2,
      steps: [],
    },
  ],
});
