import {Q} from '@nozbe/watermelondb';

import {seedCropVarieties} from '../../utils/staticData';
import {collections, database} from '..';
import type CropVariety from '../models/CropVariety';
import type {ChangeAuthor} from './changeLogRepository';
import {prepareChangeLogs} from './changeLogRepository';

/**
 * Id of a seeded variety, derived from its key in
 * shared/data/crop_varieties.json. The backend seeder builds the same id, so a
 * bundled entry and the matching server row are one record with one identity.
 */
export const seedVarietyId = (seedKey: string): string => `seed_${seedKey}`;

/** What the picker renders — a bundled seed entry and a database row look alike. */
export interface VarietyOption {
  id: string;
  name: string;
  cropType: string;
  cropName: string;
  fruit: string | null;
  usage: string | null;
  note: string | null;
  isSeed: boolean;
  approved: boolean;
}

/**
 * Varieties held in the database — server rows plus anything the farmer added.
 *
 * The seed catalogue is deliberately NOT copied into SQLite. An earlier version
 * did seed it, and the first sync then failed with "server wants client to
 * create a record that already exists": the app had written the seed rows and
 * the server sent the very same ids as new records. Reading the seeds from the
 * bundled JSON instead keeps the catalogue available with no network (Điều 1)
 * while leaving the database to hold only rows the sync actually owns.
 */
export function observeVarieties(cropType: string) {
  return collections.cropVarieties
    .query(Q.where('crop_type', cropType), Q.sortBy('name', Q.asc))
    .observeWithColumns(['name', 'approved', 'note']);
}

/**
 * The list shown in the picker: bundled seed entries plus database rows,
 * deduplicated by id. A database row wins, so an admin edit that syncs down
 * replaces the bundled copy.
 */
export function mergeVarieties(cropType: string, rows: CropVariety[]): VarietyOption[] {
  const merged = new Map<string, VarietyOption>();

  for (const seed of seedCropVarieties()) {
    if (seed.crop_type !== cropType) continue;
    merged.set(seedVarietyId(seed.id), {
      id: seedVarietyId(seed.id),
      name: seed.name,
      cropType: seed.crop_type,
      cropName: seed.crop_name,
      fruit: seed.fruit ?? null,
      usage: seed.usage ?? null,
      note: seed.note ?? null,
      isSeed: true,
      approved: true,
    });
  }

  for (const row of rows) {
    merged.set(row.id, {
      id: row.id,
      name: row.name,
      cropType: row.cropType,
      cropName: row.cropName,
      fruit: row.fruit,
      usage: row.usage,
      note: row.note,
      isSeed: row.isSeed,
      approved: row.approved,
    });
  }

  return [...merged.values()].sort((a, b) => {
    if (a.isSeed !== b.isSeed) return a.isSeed ? -1 : 1;
    return a.name.localeCompare(b.name, 'vi');
  });
}

export async function findVariety(id: string): Promise<CropVariety | null> {
  try {
    return await collections.cropVarieties.find(id);
  } catch {
    return null;
  }
}

/**
 * Adds a variety the farmer typed in. Written locally first (Điều 1); it reaches
 * the rest of the system on the next sync, where an admin can approve it.
 */
export async function createVariety(
  input: {name: string; cropType: string; cropName: string; note: string | null},
  author: ChangeAuthor,
): Promise<CropVariety> {
  let created!: CropVariety;

  await database.write(async () => {
    created = collections.cropVarieties.prepareCreate(v => {
      v.seedKey = null;
      v.name = input.name.trim();
      v.cropType = input.cropType;
      v.cropName = input.cropName;
      v.fruit = null;
      v.usage = null;
      v.note = input.note?.trim() || null;
      v.isSeed = false;
      // Usable immediately on this device; `approved` is what an admin flips
      // once the row reaches the server.
      v.approved = false;
      v.source = 'user';
      v.createdBy = author.id;
    });

    const logs = prepareChangeLogs('crop_varieties', created.id, 'create', author, [
      {field: 'name', label: 'Tên giống', oldValue: null, newValue: input.name.trim()},
    ]);

    await database.batch(created, ...logs);
  });

  return created;
}
