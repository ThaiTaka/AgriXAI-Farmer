import type {GrowthStage} from '../db/models/CropCycle';

/**
 * Infers the growth stage from the planting date when the plot has no explicit
 * crop cycle yet.
 *
 * Day ranges follow the ~90–100 day tomato cycle quoted for giống MV1 in
 * shared/data/crop_varieties.json. This is a rough guide, not agronomy: the UI
 * always labels an inferred stage as "ước tính" and lets the farmer pick another
 * stage, because a real cycle record always wins over this function.
 */
const TOMATO_STAGE_DAYS: Array<{stage: GrowthStage; untilDay: number}> = [
  {stage: 'seedling', untilDay: 20},
  {stage: 'vegetative', untilDay: 40},
  {stage: 'flowering', untilDay: 60},
  {stage: 'fruiting', untilDay: 85},
  {stage: 'harvesting', untilDay: Number.POSITIVE_INFINITY},
];

export function daysSince(timestamp: number, now: number = Date.now()): number {
  return Math.max(0, Math.floor((now - timestamp) / 86_400_000));
}

export function inferGrowthStage(
  plantedAt: number | null,
  now: number = Date.now(),
): {stage: GrowthStage; inferred: true; dayCount: number} | null {
  if (!plantedAt) return null;
  const day = daysSince(plantedAt, now);
  const match = TOMATO_STAGE_DAYS.find(entry => day <= entry.untilDay);
  return {stage: match?.stage ?? 'harvesting', inferred: true, dayCount: day};
}
