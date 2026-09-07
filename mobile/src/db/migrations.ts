/**
 * Schema migrations.
 *
 * Empty for now — v1 is the first shipped schema. Every future schema change
 * MUST add a migration step here and bump SCHEMA_VERSION, otherwise existing
 * installs lose their local data on upgrade.
 */

import {schemaMigrations} from '@nozbe/watermelondb/Schema/migrations';

export const migrations = schemaMigrations({
  migrations: [],
});
