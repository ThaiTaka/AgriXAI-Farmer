import {Q} from '@nozbe/watermelondb';

import {collections, database} from '..';
import type CropCycle from '../models/CropCycle';
import type {GrowthStage} from '../models/CropCycle';
import type Plot from '../models/Plot';
import type {ChangeAuthor} from './changeLogRepository';
import {prepareChangeLogs} from './changeLogRepository';

export interface CropCycleInput {
  name: string;
  cropType: string;
  varietyId: string | null;
  varietyName: string | null;
  stage: GrowthStage;
  startedAt: number;
  notes: string | null;
}

/** Tạo cycle mới — throw Error nếu đã có cycle chưa đóng */
export async function createCycle(
  plot: Plot,
  input: CropCycleInput,
  author: ChangeAuthor,
): Promise<CropCycle> {
  const activeCycles = await collections.cropCycles
    .query(Q.where('plot_id', plot.id), Q.where('ended_at', null))
    .fetch();

  if (activeCycles.length > 0) {
    throw new Error('Lô đất này đã có một chu kỳ đang mở.');
  }

  let created!: CropCycle;

  await database.write(async () => {
    created = collections.cropCycles.prepareCreate(cycle => {
      cycle.plotId = plot.id;
      cycle.name = input.name;
      cycle.cropType = input.cropType;
      cycle.varietyId = input.varietyId;
      cycle.varietyName = input.varietyName;
      cycle.stage = input.stage;
      cycle.startedAt = input.startedAt;
      cycle.notes = input.notes;
      cycle.ownerId = author.id;
      cycle.updatedBy = author.id;
    });

    const logs = prepareChangeLogs('crop_cycles', created.id, 'create', author, [
      {field: 'name', label: 'Tên chu kỳ', oldValue: null, newValue: input.name},
    ]);

    await database.batch(created, ...logs);
  });

  return created;
}

/** Kết thúc cycle — set endedAt, yieldKg, stage='finished' */
export async function endCycle(
  cycle: CropCycle,
  endedAt: number,
  yieldKg: number | null,
  author: ChangeAuthor,
): Promise<void> {
  await database.write(async () => {
    const updated = cycle.prepareUpdate(c => {
      c.endedAt = endedAt;
      c.yieldKg = yieldKg;
      c.stage = 'finished';
      c.updatedBy = author.id;
    });

    const logs = prepareChangeLogs('crop_cycles', cycle.id, 'update', author, [
      {field: 'ended_at', label: 'Ngày kết thúc', oldValue: null, newValue: new Date(endedAt).toISOString()},
      {field: 'stage', label: 'Giai đoạn', oldValue: cycle.stage, newValue: 'finished'},
    ]);

    await database.batch(updated, ...logs);
  });
}

/** Observable cho CyclesTab */
export function observeCycles(plotId: string) {
  return collections.cropCycles
    .query(Q.where('plot_id', plotId), Q.sortBy('started_at', Q.desc))
    .observe();
}
