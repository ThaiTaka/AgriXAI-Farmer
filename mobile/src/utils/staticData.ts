/**
 * Typed access to the offline catalogues in `shared/data/`.
 *
 * These are imported straight from the shared folder (Metro is configured to
 * watch it), so mobile and backend read the exact same bytes. Everything here is
 * available with no network at all.
 */

import cropVarietiesJson from '@shared/data/crop_varieties.json';
import fertilizerJson from '@shared/data/fertilizer_recommendations.json';

import type {VarietyBadge} from '../db/models/CropVariety';
import {humanizeCropSlug, slugifyCropName} from './cropSlug';

/* ------------------------------ care protocols ----------------------------- */

// Typed access lives in src/domain/careProtocol.ts (pure TS, jest-tested);
// re-exported here so screens keep one import path for static data.
export {
  allProtocols,
  applicationPct,
  citation,
  conversionFactors,
  conversionNote,
  protocolAvailability,
  protocolById,
  protocolsFor,
  stageForGrowth,
  stageForMonth,
  STAGE_LABELS,
  TASK_TYPE_LABELS,
  unavailableEntries,
} from '../domain/careProtocol';
export type {
  CareProtocol,
  CareStage,
  CareTask,
  CareTaskType,
  Scenario,
  ScenarioItem,
  UnavailableEntry,
} from '../domain/careProtocol';

/* ------------------------- crop catalogue (3 levels) ----------------------- */

export interface SeedVariety {
  id: string;
  name: string;
  description: string;
  usage: string;
  growing_note: string;
  badge: VarietyBadge | null;
  source: string;
}

export interface CropCategory {
  category_id: string;
  category_name: string;
  description: string;
  varieties: SeedVariety[];
}

export type CropIcon = 'tomato' | 'coffee' | 'cucumber' | 'chili' | 'other';

export interface CropType {
  id: string;
  name: string;
  icon: CropIcon;
  scientific_name: string;
  description: string;
  categories: CropCategory[];
}

const cropTypes = cropVarietiesJson.crop_types as unknown as CropType[];

export function allCropTypes(): CropType[] {
  return cropTypes;
}

export function cropTypeById(id: string): CropType | undefined {
  return cropTypes.find(c => c.id === id);
}

/**
 * Tìm cây trong danh mục theo TÊN, bỏ qua dấu và chữ hoa thường.
 *
 * Mã của danh mục là tiếng Anh (`chili`, `tomato`), còn bà con gõ tiếng Việt,
 * nên so bằng mã thì "Ớt" không bao giờ khớp với `chili` và ứng dụng đẻ ra một
 * loại cây thứ hai trùng tên. So bằng tên đã chuẩn hoá thì "Ớt", "ớt", "Ot"
 * đều về đúng một chỗ.
 */
export function cropTypeByName(name: string): CropType | undefined {
  const slug = slugifyCropName(name);
  if (!slug) return undefined;
  return cropTypes.find(c => slugifyCropName(c.name) === slug);
}

/**
 * Mã cây trồng sau khi gộp: cây bà con tự thêm mà trùng tên với danh mục thì
 * trả về mã danh mục, nhờ vậy giống của họ nằm chung với giống chuẩn thay vì
 * dựng một nhánh song song.
 */
export function canonicalCropType(cropTypeId: string, cropName?: string | null): string {
  if (cropTypeById(cropTypeId)) return cropTypeId;
  return cropTypeByName(cropName || cropTypeId)?.id ?? cropTypeId;
}

export function cropCategory(cropTypeId: string, categoryId: string): CropCategory | undefined {
  return cropTypeById(cropTypeId)?.categories.find(c => c.category_id === categoryId);
}

/**
 * Tên cây để hiện lên màn hình.
 *
 * Thứ tự: tên đã lưu → tên trong danh mục (kể cả khi bản ghi mang mã tự sinh
 * như `ot`) → cuối cùng mới dựng chữ từ mã. Không bao giờ trả về `sau_rieng`
 * hay `ot` nguyên dạng: đó là mã định danh, không phải nhãn.
 */
export function cropNameOf(cropTypeId: string, stored?: string | null): string {
  const trimmed = stored?.trim();
  if (trimmed) return trimmed;
  const catalogue = cropTypeById(cropTypeId) ?? cropTypeByName(cropTypeId);
  return catalogue?.name ?? humanizeCropSlug(cropTypeId);
}

/** Every seed variety flattened with its crop + category, for merging with rows. */
export interface FlatSeedVariety extends SeedVariety {
  crop_type: string;
  crop_name: string;
  category_id: string;
  category_name: string;
}

let flatCache: FlatSeedVariety[] | null = null;

export function flatSeedVarieties(): FlatSeedVariety[] {
  if (flatCache) return flatCache;
  flatCache = cropTypes.flatMap(crop =>
    crop.categories.flatMap(category =>
      category.varieties.map(v => ({
        ...v,
        crop_type: crop.id,
        crop_name: crop.name,
        category_id: category.category_id,
        category_name: category.category_name,
      })),
    ),
  );
  return flatCache;
}

/** Catalogue category of a seeded variety ('seed_<key>' or bare key); null for farmer-added rows. */
export function seedVarietyCategory(varietyId: string | null | undefined): string | null {
  if (!varietyId) return null;
  const key = varietyId.startsWith('seed_') ? varietyId.slice('seed_'.length) : varietyId;
  return flatSeedVarieties().find(v => v.id === key)?.category_id ?? null;
}

export const VARIETY_BADGE_LABELS: Record<VarietyBadge, string> = {
  popular: 'Phổ biến',
  new: 'Mới',
  premium: 'Premium',
};

/* ----------------------------- fertilisers -------------------------------- */

export type BudgetTierCode = 'binh_dan' | 'trung_binh' | 'cao_cap';

export interface FertilizerCategory {
  code: string;
  name: string;
  description: string;
}

export interface FertilizerProduct {
  id: string;
  name: string;
  category: string;
  npk_ratio: string;
  unit: string;
  price_min: number;
  price_max: number;
  region: string;
  source: string;
  updated_at: string;
  pack_size_kg: number | null;
  price_per_kg_min: number | null;
  price_per_kg_max: number | null;
  price_per_kg_avg: number | null;
  budget_tier: BudgetTierCode | null;
}

export interface BudgetTier {
  code: BudgetTierCode;
  name: string;
  max_price_per_kg: number | null;
}

interface FertilizerFile {
  budget_tiers: BudgetTier[];
  categories: FertilizerCategory[];
  products: FertilizerProduct[];
  categories_without_price_data: {code: string; ui_message: string; reason: string}[];
  $meta: {collected_at: string; sources: string[]; warning: string};
}

const fertilizers = fertilizerJson as unknown as FertilizerFile;

export function fertilizerCategories(): FertilizerCategory[] {
  return fertilizers.categories;
}

export function fertilizerCategory(code: string): FertilizerCategory | undefined {
  return fertilizers.categories.find(c => c.code === code);
}

export function fertilizerProducts(categoryCode?: string): FertilizerProduct[] {
  const rows = categoryCode
    ? fertilizers.products.filter(p => p.category === categoryCode)
    : fertilizers.products;
  return [...rows].sort(
    (a, b) => (a.price_per_kg_avg ?? Number.MAX_SAFE_INTEGER) - (b.price_per_kg_avg ?? Number.MAX_SAFE_INTEGER),
  );
}

export function fertilizerProduct(id: string): FertilizerProduct | undefined {
  return fertilizers.products.find(p => p.id === id);
}

export function budgetTiers(): BudgetTier[] {
  return fertilizers.budget_tiers;
}

/** Message to show for a group that has no verified price yet (never invent one). */
export function missingPriceMessage(categoryCode: string): string | null {
  return (
    fertilizers.categories_without_price_data.find(c => c.code === categoryCode)?.ui_message ?? null
  );
}

export function fertilizerCollectedAt(): string {
  return fertilizers.$meta.collected_at;
}

export function fertilizerPriceWarning(): string {
  return fertilizers.$meta.warning;
}
