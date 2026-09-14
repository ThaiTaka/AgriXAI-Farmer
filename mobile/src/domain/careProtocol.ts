/**
 * Care protocols (shared/data/care_protocols.json) — typed access and the
 * lookup rules the F1 calculator, the F5–F6 protocol screen and the plot
 * "Chăm sóc" tab all share.
 *
 * Coverage rule: a (crop, category) pair is either covered by a sourced
 * protocol or listed under `unavailable`. There is no third state, so a
 * screen can always say *why* it shows nothing.
 */

import careProtocolsJson from '@shared/data/care_protocols.json';

import type {GrowthStage} from '../db/models/CropCycle';

export type CareTaskType = 'fertilize' | 'water' | 'cultivate' | 'scout' | 'spray' | 'harvest';
export type StageModel = 'growth' | 'calendar';
export type ProtocolBasis = 'commercial' | 'nutrient';
export type Nutrient = 'N' | 'P2O5' | 'K2O';

export interface CareTask {
  key: string;
  title: string;
  detail: string;
  type: CareTaskType;
  timing?: string;
}

export interface Application {
  item_key: string;
  pct: number;
}

export interface CareStage {
  stage_code: string;
  stage_name_vi: string;
  source_stage_name_vi?: string;
  timing: string;
  duration_days: number | null;
  /** Calendar protocols (perennials): months of the year this round falls in. */
  months?: number[];
  /** Growth protocols (annuals): which app growth stages map onto this round. */
  growth_stages: GrowthStage[];
  pct_of_total_topdress: number | null;
  applications: Application[];
  tasks: CareTask[];
}

export interface ScenarioItem {
  key: string;
  name: string;
  /** Present on nutrient-basis protocols: the amount is kg of pure N / P₂O₅ / K₂O. */
  nutrient?: Nutrient;
  fertilizer_category: string;
  unit: 'kg' | 'tấn';
  min: number;
  max: number;
  price_product_id: string | null;
  note?: string;
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  items: ScenarioItem[];
}

export interface ProtocolSource {
  title: string;
  publisher: string;
  url: string;
  archive_url?: string;
  published_at: string | null;
  collected_at: string;
  section?: string;
}

export interface CareProtocol {
  id: string;
  crop_type: string;
  crop_name: string;
  /** null = every category of the crop. */
  category_ids: string[] | null;
  name: string;
  source: ProtocolSource;
  disclaimer: string;
  stage_model: StageModel;
  basis: ProtocolBasis;
  reference_area: {value: number; unit: string; m2: number};
  cycle_note: string;
  scenarios: Scenario[];
  base_application: {timing: string; applications: Application[]; note: string};
  stages: CareStage[];
  extra_rules: string[];
}

export interface UnavailableEntry {
  crop_type: string;
  crop_name: string;
  category_id: string;
  category_name: string;
  reason: string;
  suggested_sources: {title: string; url: string}[];
}

export interface ConversionFactor {
  product_name: string;
  pct: number;
  fertilizer_category: string;
  price_product_id: string | null;
}

interface CareProtocolsFile {
  $meta: {
    stage_codes: GrowthStage[];
    conversion: Record<string, {note: string; formula_source: string; factors: Record<Nutrient, ConversionFactor>}>;
    sources: string[];
  };
  protocols: CareProtocol[];
  unavailable: UnavailableEntry[];
}

const file = careProtocolsJson as unknown as CareProtocolsFile;

export function allProtocols(): CareProtocol[] {
  return file.protocols;
}

export function protocolById(id: string): CareProtocol | undefined {
  return file.protocols.find(p => p.id === id);
}

/** Every protocol that applies to a crop, or to one category of it. */
export function protocolsFor(cropType: string, categoryId?: string | null): CareProtocol[] {
  return file.protocols.filter(
    p =>
      p.crop_type === cropType &&
      (p.category_ids === null || !categoryId || p.category_ids.includes(categoryId)),
  );
}

/**
 * What to show for a crop + category. `protocols` is the list to offer;
 * `unavailable` explains the gap when that list is empty. Both empty means
 * the crop is one the farmer added themselves and no catalogue entry exists.
 */
export function protocolAvailability(
  cropType: string,
  categoryId?: string | null,
): {protocols: CareProtocol[]; unavailable: UnavailableEntry | null} {
  const protocols = protocolsFor(cropType, categoryId);
  if (protocols.length > 0) return {protocols, unavailable: null};
  const unavailable =
    file.unavailable.find(u => u.crop_type === cropType && (!categoryId || u.category_id === categoryId)) ??
    null;
  return {protocols: [], unavailable};
}

export function unavailableEntries(cropType?: string): UnavailableEntry[] {
  return cropType ? file.unavailable.filter(u => u.crop_type === cropType) : file.unavailable;
}

export function conversionFactors(cropType: string): Record<Nutrient, ConversionFactor> | undefined {
  return file.$meta.conversion[cropType]?.factors;
}

export function conversionNote(cropType: string): string | undefined {
  return file.$meta.conversion[cropType]?.note;
}

/** The protocol round an annual crop is in, given the app's growth stage. */
export function stageForGrowth(protocol: CareProtocol, stage: GrowthStage): CareStage | undefined {
  if (protocol.stage_model !== 'growth') return undefined;
  return protocol.stages.find(s => s.growth_stages.includes(stage));
}

/** The protocol round a perennial is in for a calendar month (1–12). */
export function stageForMonth(protocol: CareProtocol, month: number): CareStage | undefined {
  if (protocol.stage_model !== 'calendar') return undefined;
  return protocol.stages.find(s => (s.months ?? []).includes(month));
}

/** Percentage of one item applied in a stage (0 when the stage skips it). */
export function applicationPct(stage: CareStage, itemKey: string): number {
  return stage.applications.find(a => a.item_key === itemKey)?.pct ?? 0;
}

export const STAGE_LABELS: Record<GrowthStage, string> = {
  seedling: 'Cây con / hồi xanh',
  vegetative: 'Sinh trưởng thân lá',
  flowering: 'Ra hoa',
  fruiting: 'Đậu quả / nuôi quả',
  harvesting: 'Thu hoạch',
  finished: 'Đã kết thúc',
};

export const TASK_TYPE_LABELS: Record<CareTaskType, string> = {
  fertilize: 'Bón phân',
  water: 'Tưới nước',
  cultivate: 'Canh tác',
  scout: 'Thăm đồng',
  spray: 'Phun',
  harvest: 'Thu hoạch',
};

/** Short citation line for a protocol: publisher · date. */
export function citation(protocol: CareProtocol): string {
  const parts = [protocol.source.publisher];
  if (protocol.source.published_at) parts.push(`đăng ${protocol.source.published_at}`);
  parts.push(`tra cứu ${protocol.source.collected_at}`);
  return parts.join(' · ');
}
