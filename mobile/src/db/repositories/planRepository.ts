import {Q} from '@nozbe/watermelondb';

import type {CalcResult} from '../../domain/fertilizerCalc';
import {collections, database} from '..';
import type Plan from '../models/Plan';
import type {PlanItem} from '../models/Plan';
import type {ChangeAuthor} from './changeLogRepository';
import {prepareChangeLogs} from './changeLogRepository';

export interface PlanInput {
  plotId: string | null;
  cropType: string;
  cropName: string | null;
  categoryId: string | null;
  varietyId: string | null;
  varietyName: string | null;
  protocolId: string;
  scenarioId: string;
  scenarioName: string;
  areaInput: number;
  areaUnit: string;
  result: CalcResult;
  note: string | null;
}

/** The scaled lines as stored: enough to redraw the plan without the protocol file. */
export function planItemsFromResult(result: CalcResult): PlanItem[] {
  return result.lines.map(line => ({
    key: line.key,
    name: line.name,
    fertilizer_category: line.fertilizerCategory,
    unit: line.unit,
    min: line.min,
    max: line.max,
    price_product_id: line.priceProductId,
    price_per_kg: line.pricePerKg,
    cost_min: line.costMin,
    cost_max: line.costMax,
  }));
}

export function observePlans(ownerId: string) {
  return collections.plans
    .query(Q.where('owner_id', ownerId), Q.sortBy('created_at', Q.desc))
    .observeWithColumns(['scenario_name', 'cost_max', 'updated_at']);
}

/** Written locally first (Điều 1); the sync adapter carries it up later. */
export async function savePlan(input: PlanInput, author: ChangeAuthor): Promise<Plan> {
  let created!: Plan;
  await database.write(async () => {
    created = collections.plans.prepareCreate(plan => {
      plan.plotId = input.plotId;
      plan.cropType = input.cropType;
      plan.cropName = input.cropName;
      plan.categoryId = input.categoryId;
      plan.varietyId = input.varietyId;
      plan.varietyName = input.varietyName;
      plan.protocolId = input.protocolId;
      plan.scenarioId = input.scenarioId;
      plan.scenarioName = input.scenarioName;
      plan.areaInput = input.areaInput;
      plan.areaUnit = input.areaUnit;
      plan.areaM2 = input.result.areaM2;
      plan.itemsJson = JSON.stringify(planItemsFromResult(input.result));
      plan.costMin = input.result.costMin;
      plan.costMax = input.result.costMax;
      plan.note = input.note;
      plan.ownerId = author.id;
      plan.updatedBy = author.id;
    });
    const logs = prepareChangeLogs('plans', created.id, 'create', author, [
      {field: 'scenario_name', label: 'Phương án', oldValue: null, newValue: input.scenarioName},
    ]);
    await database.batch(created, ...logs);
  });
  return created;
}

export async function deletePlan(plan: Plan, author: ChangeAuthor): Promise<void> {
  await database.write(async () => {
    const logs = prepareChangeLogs('plans', plan.id, 'delete', author, [
      {field: 'scenario_name', label: 'Phương án', oldValue: plan.scenarioName, newValue: null},
    ]);
    await database.batch(...logs);
    await plan.markAsDeleted();
  });
}
