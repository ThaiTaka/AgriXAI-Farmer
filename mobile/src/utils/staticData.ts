/**
 * Typed access to the offline catalogues in `shared/data/`.
 *
 * These are imported straight from the shared folder (Metro is configured to
 * watch it), so mobile and backend read the exact same bytes. Everything here is
 * available with no network at all.
 */

import careProtocolsJson from '@shared/data/care_protocols.json';
import cropVarietiesJson from '@shared/data/crop_varieties.json';

import type {GrowthStage} from '../db/models/CropCycle';

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

export interface SeedVariety {
  id: string;
  name: string;
  crop_type: string;
  crop_name: string;
  fruit?: string;
  usage?: string;
  note?: string;
  is_seed: boolean;
  source: string;
  approved: boolean;
}

const careProtocols = careProtocolsJson.protocols as unknown as CareProtocol[];
const seedVarieties = cropVarietiesJson.varieties as unknown as SeedVariety[];

export function careProtocolFor(cropType: string): CareProtocol | undefined {
  return careProtocols.find(p => p.crop_type === cropType);
}

export function careStageFor(cropType: string, stage: GrowthStage): CareStage | undefined {
  return careProtocolFor(cropType)?.stages.find(s => s.stage_code === stage);
}

export function allCareStages(cropType: string): CareStage[] {
  return careProtocolFor(cropType)?.stages ?? [];
}

export function seedCropVarieties(): SeedVariety[] {
  return seedVarieties;
}

/** Crop types the app knows about. Tomato is the only one with a care protocol today. */
export const CROP_TYPES = [{code: 'ca_chua', name: 'Cà chua'}] as const;

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
