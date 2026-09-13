/**
 * Typed access to the offline catalogues in `shared/data/`.
 *
 * These are imported straight from the shared folder (Metro is configured to
 * watch it), so mobile and backend read the exact same bytes. Everything here is
 * available with no network at all.
 */

import careProtocolsJson from '@shared/data/care_protocols.json';
import cropVarietiesJson from '@shared/data/crop_varieties.json';
import fertilizerJson from '@shared/data/fertilizer_recommendations.json';

import type {GrowthStage} from '../db/models/CropCycle';
import type {VarietyBadge} from '../db/models/CropVariety';

/* ------------------------------ care protocols ----------------------------- */

export type CareTaskType = 'fertilize' | 'water' | 'cultivate' | 'scout' | 'spray' | 'harvest';

export interface CareTask {
  key: string;
  title: string;
  detail: string;
  type: CareTaskType;
}

export interface CareStage {
  stage_code: string;
  stage_name_vi: string;
  source_stage_code: string;
  source_stage_name_vi: string;
  pct_of_total_topdress: number;
  tasks: CareTask[];
}

export interface CareProtocol {
  id: string;
  crop_type: string;
  crop_name: string;
  name: string;
  source: string;
  collected_at: string;
  disclaimer: string;
  stage_mapping_note: string;
  stages: CareStage[];
}

const careProtocols = careProtocolsJson.protocols as unknown as CareProtocol[];

export function careProtocolFor(cropType: string): CareProtocol | undefined {
  return careProtocols.find(p => p.crop_type === cropType);
}

export function careStageFor(cropType: string, stage: GrowthStage): CareStage | undefined {
  return careProtocolFor(cropType)?.stages.find(s => s.stage_code === stage);
}

export function allCareStages(cropType: string): CareStage[] {
  return careProtocolFor(cropType)?.stages ?? [];
}

export const STAGE_LABELS: Record<GrowthStage, string> = {
  seedling: 'Cây con / hồi xanh',
  vegetative: 'Sinh trưởng thân lá',
  flowering: 'Ra hoa',
  fruiting: 'Đậu quả / nuôi quả',
  harvesting: 'Thu hoạch',
  finished: 'Đã kết thúc',
};

export const careProtocolDisclaimer = (cropType: string): string =>
  careProtocolFor(cropType)?.disclaimer ?? '';

export const careProtocolSource = (cropType: string): string =>
  careProtocolFor(cropType)?.source ?? '';

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

export function cropCategory(cropTypeId: string, categoryId: string): CropCategory | undefined {
  return cropTypeById(cropTypeId)?.categories.find(c => c.category_id === categoryId);
}

/** Display name of a crop, falling back to the raw id for farmer-added crops. */
export function cropNameOf(cropTypeId: string, stored?: string | null): string {
  return stored || cropTypeById(cropTypeId)?.name || cropTypeId;
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
