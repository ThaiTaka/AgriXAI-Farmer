/**
 * Schema migrations.
 *
 * Every schema change MUST add a step here and bump SCHEMA_VERSION, otherwise an
 * existing install loses its local data on upgrade — which for this app means a
 * farmer losing work they did offline.
 */

import {
  addColumns,
  schemaMigrations,
  unsafeExecuteSql,
} from '@nozbe/watermelondb/Schema/migrations';

export const migrations = schemaMigrations({
  migrations: [
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
