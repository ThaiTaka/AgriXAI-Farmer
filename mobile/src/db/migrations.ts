/**
 * Schema migrations.
 *
 * Every schema change MUST add a step here and bump SCHEMA_VERSION, otherwise an
 * existing install loses its local data on upgrade — which for this app means a
 * farmer losing work they did offline.
 */

import {schemaMigrations} from '@nozbe/watermelondb/Schema/migrations';

export const migrations = schemaMigrations({
  migrations: [
    {
      // v2 -> v3: remove diagnosis feature entirely.
      // WatermelonDB does not support destroyTable in migrations.
      // The tables are simply no longer declared in the schema, so they will
      // be ignored. On a fresh install they won't exist; on an upgrade the
      // old tables remain on disk but are inert (never read, never synced).
      toVersion: 3,
      steps: [],
    },
    {
      // v1 -> v2: image diagnosis (Giai đoạn 2) — kept for upgrade path.
      toVersion: 2,
      steps: [],
    },
  ],
});
