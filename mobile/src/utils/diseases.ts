/**
 * The tomato disease catalogue, read from the bundled `shared/data` copy.
 *
 * Bundled rather than fetched: the treatment advice is the part a farmer needs
 * most when standing in a field with one bar of signal, so it must never depend
 * on a request succeeding (Điều 3).
 */

import diseasesJson from '@shared/data/tomato_diseases.json';

import type {SeverityKey} from '../db/models/Diagnosis';

export type DiseaseType = 'fungus' | 'bacteria' | 'virus' | 'pest' | 'healthy';

export interface DiseaseProduct {
  name: string;
  group: string;
  product_url: string | null;
}

export interface Disease {
  key: string;
  name: string;
  name_en: string;
  type: DiseaseType;
  pathogen: string;
  quick_cue: string;
  symptoms: string;
  conditions: string;
  treatments: string[];
  products: DiseaseProduct[];
  /** Shown above the product list when the drugs do not target the disease itself. */
  product_note: string | null;
  /** Shown INSTEAD of a product list when there is nothing worth buying. */
  no_product_text: string | null;
  prevention: string[];
  severity: SeverityKey;
  video_embed_url: string | null;
}

const catalogue = diseasesJson.diseases as unknown as Disease[];

export function allDiseases(): Disease[] {
  return catalogue;
}

export function diseaseByKey(key: string): Disease | undefined {
  return catalogue.find(d => d.key === key);
}

/** Falls back to the raw key so an unknown prediction is still readable. */
export function diseaseName(key: string): string {
  return diseaseByKey(key)?.name ?? key;
}

/**
 * Default severity for a disease.
 *
 * This is the disease's TYPICAL severity, not a measurement of the photo — the
 * model reports which disease it sees, not how far along it is. Anything the
 * catalogue does not know is treated as moderate rather than silently healthy:
 * under-reporting a sick plant is the more expensive mistake.
 */
export function severityForDisease(key: string): SeverityKey {
  return diseaseByKey(key)?.severity ?? 'moderate';
}

/**
 * The special cases the brief calls out, resolved from the catalogue rather than
 * hard-coded here so the data file stays the single source of truth.
 */
export interface TreatmentAdvice {
  disease: Disease;
  hasProducts: boolean;
  /** mosaic_virus / healthy — nothing to buy, and saying so plainly matters. */
  noProductText: string | null;
  /** yellow_leaf_curl_virus — the drugs listed target the vector, not the virus. */
  productNote: string | null;
  /** spider_mites — a mite, so fungicide is the wrong shelf entirely. */
  pestWarning: string | null;
}

export function treatmentAdvice(key: string): TreatmentAdvice | null {
  const disease = diseaseByKey(key);
  if (!disease) return null;

  return {
    disease,
    hasProducts: disease.products.length > 0,
    noProductText: disease.no_product_text,
    productNote: disease.product_note,
    pestWarning:
      disease.type === 'pest'
        ? 'Đây là NHỆN HẠI, không phải nấm. Phun thuốc trừ nấm sẽ KHÔNG có tác dụng — ' +
          'phải dùng thuốc trừ nhện (acaricide) chuyên biệt.'
        : null,
  };
}

export const DISEASE_TYPE_LABELS: Record<DiseaseType, string> = {
  fungus: 'Nấm',
  bacteria: 'Vi khuẩn',
  virus: 'Virus',
  pest: 'Nhện hại',
  healthy: 'Khoẻ',
};
