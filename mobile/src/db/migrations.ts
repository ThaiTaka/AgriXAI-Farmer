/**
 * Schema migrations.
 *
 * Every schema change MUST add a step here and bump SCHEMA_VERSION, otherwise an
 * existing install loses its local data on upgrade — which for this app means a
 * farmer losing work they did offline.
 */

import {addColumns, createTable, schemaMigrations} from '@nozbe/watermelondb/Schema/migrations';

export const migrations = schemaMigrations({
  migrations: [
    {
      // v1 -> v2: image diagnosis (Giai đoạn 2).
      toVersion: 2,
      steps: [
        addColumns({
          table: 'diagnoses',
          columns: [{name: 'heatmap_json', type: 'string', isOptional: true}],
        }),
        createTable({
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
    },
  ],
});
