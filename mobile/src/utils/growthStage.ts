import type {GrowthStage} from '../db/models/CropCycle';

/**
 * Infers the growth stage from the planting date when the plot has no explicit
 * crop cycle yet.
 *
 * Day ranges follow a ~90–100 day annual cycle (first taken from the tomato
 * MV1 figure, ADR 0002 §7). This is a rough guide, not agronomy: the UI
 * always labels an inferred stage as "ước tính" and lets the farmer pick another
 * stage, because a real cycle record always wins over this function.
 *
 * Since ADR 0009 the protocol round on the care tab follows the protocol's
 * own dated rounds (`stageForDay` in domain/careProtocol.ts); this ladder only
 * fills in where a procedure gives no day count.
 */
const STAGE_DAYS: Array<{stage: GrowthStage; untilDay: number}> = [
  {stage: 'seedling', untilDay: 20},
  {stage: 'vegetative', untilDay: 40},
  {stage: 'flowering', untilDay: 60},
  {stage: 'fruiting', untilDay: 85},
  {stage: 'harvesting', untilDay: Number.POSITIVE_INFINITY},
];

export function daysSince(timestamp: number, now: number = Date.now()): number {
  return Math.max(0, Math.floor((now - timestamp) / 86_400_000));
}

/** The ladder's stage for a day count. */
export function growthStageForDay(day: number): GrowthStage {
  return STAGE_DAYS.find(entry => day <= entry.untilDay)?.stage ?? 'harvesting';
}

export function inferGrowthStage(
  plantedAt: number | null,
  now: number = Date.now(),
): {stage: GrowthStage; inferred: true; dayCount: number} | null {
  if (!plantedAt) return null;
  const day = daysSince(plantedAt, now);
  return {stage: growthStageForDay(day), inferred: true, dayCount: day};
}
