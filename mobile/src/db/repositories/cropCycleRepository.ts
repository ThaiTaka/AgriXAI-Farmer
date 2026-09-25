import {Q} from '@nozbe/watermelondb';

import type {Season} from '../../domain/cultivation';
import {seasonOf} from '../../domain/cultivation';
import {toSquareMetres} from '../../domain/areaUnits';
import {collections, database} from '..';
import type CropCycle from '../models/CropCycle';
import type {GrowthStage} from '../models/CropCycle';
import type Plot from '../models/Plot';
import type {ChangeAuthor} from './changeLogRepository';
import {prepareChangeLogs} from './changeLogRepository';

export interface CropCycleInput {
  name: string;
  cropType: string;
  /** Stored so a crop the farmer invented keeps its name; defaults to the plot's. */
  cropName?: string | null;
  varietyId: string | null;
  varietyName: string | null;
  stage: GrowthStage;
  startedAt: number;
  /** Defaults to the season of `startedAt` (domain/cultivation.ts). */
  season?: Season | null;
  /** Defaults to the plot's current area, in m². */
  areaM2?: number | null;
  notes: string | null;
  mediaJson?: string | null;
}

/** A season already over, written down after the fact — the cultivation history. */
export interface PastCycleInput extends Omit<CropCycleInput, 'stage'> {
  endedAt: number;
  yieldKg: number | null;
}

export interface CycleUpdate {
  name?: string;
  cropType?: string;
  cropName?: string | null;
  varietyName?: string | null;
  season?: Season;
  startedAt?: number;
  endedAt?: number | null;
  areaM2?: number | null;
  yieldKg?: number | null;
  notes?: string | null;
  mediaJson?: string | null;
}

const WATCHED = [
  'name',
  'crop_type',
  'crop_name',
  'variety_name',
  'stage',
  'season',
  'started_at',
  'ended_at',
  'area_m2',
  'yield_kg',
  'notes',
  'media_json',
];

export function plotAreaM2(plot: Plot): number | null {
  const m2 = toSquareMetres(plot.area, plot.areaUnit);
  return m2 > 0 ? m2 : null;
}

async function openCycles(plotId: string): Promise<CropCycle[]> {
  return collections.cropCycles.query(Q.where('plot_id', plotId), Q.where('ended_at', null)).fetch();
}

function fill(cycle: CropCycle, plot: Plot, input: CropCycleInput, author: ChangeAuthor) {
  cycle.plotId = plot.id;
  cycle.name = input.name;
  cycle.cropType = input.cropType;
  cycle.cropName = input.cropName ?? (input.cropType === plot.cropType ? plot.cropName : null);
  cycle.varietyId = input.varietyId;
  cycle.varietyName = input.varietyName;
  cycle.stage = input.stage;
  cycle.season = input.season ?? seasonOf(input.startedAt);
  cycle.startedAt = input.startedAt;
  cycle.areaM2 = input.areaM2 ?? plotAreaM2(plot);
  cycle.notes = input.notes;
  cycle.mediaJson = input.mediaJson ?? null;
  cycle.ownerId = author.id;
  cycle.updatedBy = author.id;
}

/** Tạo cycle mới — throw Error nếu đã có cycle chưa đóng */
export async function createCycle(
  plot: Plot,
  input: CropCycleInput,
  author: ChangeAuthor,
): Promise<CropCycle> {
  const active = await openCycles(plot.id);
  if (active.length > 0) {
    throw new Error('Lô đất này đã có một chu kỳ đang mở.');
  }

  let created!: CropCycle;

  await database.write(async () => {
    created = collections.cropCycles.prepareCreate(cycle => {
      fill(cycle, plot, input, author);
      cycle.endedAt = null;
      cycle.yieldKg = null;
    });

    const logs = prepareChangeLogs('crop_cycles', created.id, 'create', author, [
      {field: 'name', label: 'Tên chu kỳ', oldValue: null, newValue: input.name},
    ]);

    await database.batch(created, ...logs);
  });

  return created;
}

/**
 * Writes down a finished season — "Vụ Xuân 2025: cà chua, 1,4 tấn". Allowed
 * alongside the crop growing now: history does not compete with the present.
 */
export async function recordPastCycle(plot: Plot, input: PastCycleInput, author: ChangeAuthor): Promise<CropCycle> {
  if (input.endedAt < input.startedAt) throw new Error('Ngày kết thúc không được trước ngày xuống giống.');
  if (input.yieldKg != null && input.yieldKg < 0) throw new Error('Sản lượng không được âm.');
  let created!: CropCycle;
  await database.write(async () => {
    created = collections.cropCycles.prepareCreate(cycle => {
      fill(cycle, plot, {...input, stage: 'finished'}, author);
      cycle.endedAt = input.endedAt;
      cycle.yieldKg = input.yieldKg;
    });
    const logs = prepareChangeLogs('crop_cycles', created.id, 'create', author, [
      {field: 'name', label: 'Vụ đã qua', oldValue: null, newValue: input.name},
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
  mediaJson?: string | null,
): Promise<void> {
  await database.write(async () => {
    const updated = cycle.prepareUpdate(c => {
      c.endedAt = endedAt;
      c.yieldKg = yieldKg;
      c.stage = 'finished';
      if (mediaJson !== undefined) c.mediaJson = mediaJson;
      c.updatedBy = author.id;
    });

    const logs = prepareChangeLogs('crop_cycles', cycle.id, 'update', author, [
      {field: 'ended_at', label: 'Ngày kết thúc', oldValue: null, newValue: new Date(endedAt).toISOString()},
      {field: 'stage', label: 'Giai đoạn', oldValue: cycle.stage, newValue: 'finished'},
    ]);

    await database.batch(updated, ...logs);
  });
}

export async function updateCycle(cycle: CropCycle, patch: CycleUpdate, author: ChangeAuthor): Promise<void> {
  const startedAt = patch.startedAt ?? cycle.startedAt;
  const endedAt = patch.endedAt !== undefined ? patch.endedAt : cycle.endedAt;
  if (endedAt != null && endedAt < startedAt) throw new Error('Ngày kết thúc không được trước ngày xuống giống.');
  if (patch.yieldKg != null && patch.yieldKg < 0) throw new Error('Sản lượng không được âm.');
  if (endedAt == null && cycle.endedAt != null) {
    const others = (await openCycles(cycle.plotId)).filter(c => c.id !== cycle.id);
    if (others.length > 0) throw new Error('Lô đất này đã có một chu kỳ đang mở.');
  }
  await database.write(async () => {
    const updated = cycle.prepareUpdate(c => {
      if (patch.name !== undefined) c.name = patch.name;
      if (patch.cropType !== undefined) c.cropType = patch.cropType;
      if (patch.cropName !== undefined) c.cropName = patch.cropName;
      if (patch.varietyName !== undefined) c.varietyName = patch.varietyName;
      if (patch.season !== undefined) c.season = patch.season;
      if (patch.startedAt !== undefined) c.startedAt = patch.startedAt;
      if (patch.endedAt !== undefined) {
        c.endedAt = patch.endedAt;
        if (patch.endedAt != null) c.stage = 'finished';
      }
      if (patch.areaM2 !== undefined) c.areaM2 = patch.areaM2;
      if (patch.yieldKg !== undefined) c.yieldKg = patch.yieldKg;
      if (patch.notes !== undefined) c.notes = patch.notes;
      if (patch.mediaJson !== undefined) c.mediaJson = patch.mediaJson;
      c.updatedBy = author.id;
    });
    const changes = [];
    if (patch.yieldKg !== undefined && patch.yieldKg !== cycle.yieldKg) {
      changes.push({
        field: 'yield_kg',
        label: 'Sản lượng',
        oldValue: cycle.yieldKg == null ? null : String(cycle.yieldKg),
        newValue: patch.yieldKg == null ? null : String(patch.yieldKg),
      });
    }
    if (patch.name !== undefined && patch.name !== cycle.name) {
      changes.push({field: 'name', label: 'Tên vụ', oldValue: cycle.name, newValue: patch.name});
    }
    const logs = changes.length ? prepareChangeLogs('crop_cycles', cycle.id, 'update', author, changes) : [];
    await database.batch(updated, ...logs);
  });
}

export async function deleteCycle(cycle: CropCycle, author: ChangeAuthor): Promise<void> {
  await database.write(async () => {
    const logs = prepareChangeLogs('crop_cycles', cycle.id, 'delete', author, [
      {field: 'name', label: 'Vụ trồng', oldValue: cycle.name, newValue: null},
    ]);
    await database.batch(...logs);
    await cycle.markAsDeleted();
  });
}

/** Observable cho CyclesTab — re-emits when a season's yield, dates or photos change. */
export function observeCycles(plotId: string) {
  return collections.cropCycles
    .query(Q.where('plot_id', plotId), Q.sortBy('started_at', Q.desc))
    .observeWithColumns(WATCHED);
}
