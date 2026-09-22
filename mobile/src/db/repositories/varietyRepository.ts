import {Q} from '@nozbe/watermelondb';

import {slugifyCropName} from '../../utils/cropSlug';
import {allCropTypes, canonicalCropType, cropNameOf, flatSeedVarieties} from '../../utils/staticData';
import type {CropIcon} from '../../utils/staticData';
import {collections, database} from '..';
import type CropVariety from '../models/CropVariety';
import type {VarietyBadge} from '../models/CropVariety';
import type {ChangeAuthor} from './changeLogRepository';
import {prepareChangeLogs} from './changeLogRepository';

/**
 * Id of a seeded variety, derived from its key in
 * shared/data/crop_varieties.json. The backend seeder builds the same id, so a
 * bundled entry and the matching server row are one record with one identity.
 */
export const seedVarietyId = (seedKey: string): string => `seed_${seedKey}`;

/** Category id used for every variety a farmer adds under a crop of their own. */
export const USER_CATEGORY_ID = 'user_defined';
export const USER_CATEGORY_NAME = 'Giống tự thêm';

/** What the picker renders — a bundled seed entry and a database row look alike. */
export interface VarietyOption {
  id: string;
  name: string;
  cropType: string;
  cropName: string;
  categoryId: string;
  categoryName: string;
  description: string | null;
  usage: string | null;
  growingNote: string | null;
  badge: VarietyBadge | null;
  isSeed: boolean;
  approved: boolean;
}

/** A crop type as shown in step 1: from the catalogue, or created by a farmer. */
export interface CropTypeOption {
  id: string;
  name: string;
  icon: CropIcon;
  categoryCount: number;
  varietyCount: number;
  isCatalogue: boolean;
}

/** A category as shown in step 2. */
export interface CategoryOption {
  id: string;
  name: string;
  description: string | null;
  varietyCount: number;
}

/**
 * Every variety row in the database — server rows plus anything the farmer
 * added. Small enough to observe whole: a catalogue is tens of rows, not
 * thousands, and one observable keeps all three steps consistent.
 *
 * The seed catalogue is deliberately NOT copied into SQLite. An earlier version
 * did seed it, and the first sync then failed with "server wants client to
 * create a record that already exists". Reading the seeds from the bundled JSON
 * keeps the catalogue available with no network (Điều 1) while leaving the
 * database to hold only rows the sync actually owns.
 */
export function observeAllVarieties() {
  return collections.cropVarieties
    .query(Q.sortBy('name', Q.asc))
    .observeWithColumns(['name', 'approved', 'description', 'category_id', 'crop_type']);
}

function rowToOption(row: CropVariety): VarietyOption {
  // Bà con gõ "Ớt" thì mã tự sinh là `ot`, không khớp mã danh mục `chili`,
  // nên trước đây bước 1 hiện hai cây "Ớt" cạnh nhau. Quy về mã danh mục ngay
  // lúc đọc: giống tự thêm nằm chung với giống chuẩn, và bản ghi cũ đã lỡ lưu
  // cũng tự hết trùng mà không cần chạy migration.
  const cropType = canonicalCropType(row.cropType, row.cropName);
  return {
    id: row.id,
    name: row.name,
    cropType,
    cropName: cropNameOf(cropType, cropType === row.cropType ? row.cropName : null),
    categoryId: row.categoryId ?? USER_CATEGORY_ID,
    categoryName: row.categoryName ?? USER_CATEGORY_NAME,
    description: row.description,
    usage: row.usage,
    growingNote: row.growingNote,
    badge: row.badge,
    isSeed: row.isSeed,
    approved: row.approved,
  };
}

/**
 * Bundled seed entries plus database rows, deduplicated by id. A database row
 * wins, so an admin edit that syncs down replaces the bundled copy.
 */
export function mergeAllVarieties(rows: CropVariety[]): VarietyOption[] {
  const merged = new Map<string, VarietyOption>();

  for (const seed of flatSeedVarieties()) {
    merged.set(seedVarietyId(seed.id), {
      id: seedVarietyId(seed.id),
      name: seed.name,
      cropType: seed.crop_type,
      cropName: seed.crop_name,
      categoryId: seed.category_id,
      categoryName: seed.category_name,
      description: seed.description,
      usage: seed.usage,
      growingNote: seed.growing_note,
      badge: seed.badge,
      isSeed: true,
      approved: true,
    });
  }

  for (const row of rows) merged.set(row.id, rowToOption(row));

  return [...merged.values()];
}

/** Step 1 list: catalogue crops first, then crops farmers created, by name. */
export function cropTypeOptions(all: VarietyOption[]): CropTypeOption[] {
  const catalogue = allCropTypes();
  const options: CropTypeOption[] = catalogue.map(crop => ({
    id: crop.id,
    name: crop.name,
    icon: crop.icon,
    categoryCount: crop.categories.length,
    varietyCount: all.filter(v => v.cropType === crop.id).length,
    isCatalogue: true,
  }));

  const known = new Set(catalogue.map(c => c.id));
  const extra = new Map<string, CropTypeOption>();
  for (const v of all) {
    if (known.has(v.cropType)) continue;
    const current = extra.get(v.cropType);
    if (current) {
      current.varietyCount += 1;
    } else {
      extra.set(v.cropType, {
        id: v.cropType,
        name: v.cropName,
        icon: 'other',
        categoryCount: 1,
        varietyCount: 1,
        isCatalogue: false,
      });
    }
  }

  return [...options, ...[...extra.values()].sort((a, b) => a.name.localeCompare(b.name, 'vi'))];
}

/** Step 2 list for one crop: catalogue categories, plus "Giống tự thêm" if any. */
export function categoryOptions(cropTypeId: string, all: VarietyOption[]): CategoryOption[] {
  const mine = all.filter(v => v.cropType === cropTypeId);
  const crop = allCropTypes().find(c => c.id === cropTypeId);

  const options: CategoryOption[] = (crop?.categories ?? []).map(category => ({
    id: category.category_id,
    name: category.category_name,
    description: category.description,
    varietyCount: mine.filter(v => v.categoryId === category.category_id).length,
  }));

  const userAdded = mine.filter(v => !options.some(o => o.id === v.categoryId));
  if (userAdded.length > 0) {
    options.push({
      id: USER_CATEGORY_ID,
      name: USER_CATEGORY_NAME,
      description: 'Giống do người dùng nhập, chưa nằm trong danh mục chuẩn.',
      varietyCount: userAdded.length,
    });
  }
  return options;
}

/** Step 3 list: seed entries first, then farmer-added, both alphabetical. */
export function varietyOptions(
  cropTypeId: string,
  categoryId: string,
  all: VarietyOption[],
): VarietyOption[] {
  const catalogueCategoryIds = new Set(
    allCropTypes()
      .find(c => c.id === cropTypeId)
      ?.categories.map(c => c.category_id) ?? [],
  );

  return all
    .filter(v => v.cropType === cropTypeId)
    .filter(v =>
      categoryId === USER_CATEGORY_ID
        ? !catalogueCategoryIds.has(v.categoryId)
        : v.categoryId === categoryId,
    )
    .sort((a, b) => {
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

export interface NewVarietyInput {
  name: string;
  cropType: string;
  cropName: string;
  categoryId: string;
  categoryName: string;
  description: string | null;
}

export {slugifyCropName};

/**
 * Adds a variety the farmer typed in. Written locally first (Điều 1); it reaches
 * the rest of the system on the next sync, where an admin can approve it.
 */
export async function createVariety(
  input: NewVarietyInput,
  author: ChangeAuthor,
): Promise<CropVariety> {
  let created!: CropVariety;

  await database.write(async () => {
    created = collections.cropVarieties.prepareCreate(v => {
      v.seedKey = null;
      v.name = input.name.trim();
      v.cropType = input.cropType;
      v.cropName = input.cropName.trim();
      v.categoryId = input.categoryId;
      v.categoryName = input.categoryName;
      v.description = input.description?.trim() || null;
      v.usage = null;
      v.growingNote = null;
      v.badge = null;
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
