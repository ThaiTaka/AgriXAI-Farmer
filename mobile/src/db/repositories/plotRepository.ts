import {Q} from '@nozbe/watermelondb';

import {formatArea, formatDate} from '../../utils/format';
import {generateUniquePlotCode} from '../../utils/plotCode';
import {collections, database} from '..';
import type Plot from '../models/Plot';
import type {PlotStatus} from '../models/Plot';
import type {ChangeAuthor, FieldChange} from './changeLogRepository';
import {prepareChangeLogs} from './changeLogRepository';

export interface PlotInput {
  code: string;
  name: string;
  region: string | null;
  area: number;
  areaUnit: string;
  cropType: string;
  varietyId: string | null;
  varietyName: string | null;
  plantedAt: number | null;
  status: PlotStatus;
  notes: string | null;
}

export const PLOT_STATUS_LABELS: Record<PlotStatus, string> = {
  active: 'Đang canh tác',
  fallow: 'Bỏ hoá',
  harvested: 'Đã thu hoạch',
};

/** Field labels used by the audit trail — kept next to the writer so they can't drift. */
const FIELD_LABELS: Record<keyof PlotInput, string> = {
  code: 'Mã vùng trồng',
  name: 'Tên lô đất',
  region: 'Khu vực',
  area: 'Diện tích',
  areaUnit: 'Đơn vị diện tích',
  cropType: 'Cây trồng',
  varietyId: 'Giống cây',
  varietyName: 'Giống cây',
  plantedAt: 'Ngày trồng',
  status: 'Trạng thái',
  notes: 'Ghi chú',
};

export function observePlots(ownerId: string) {
  return collections.plots
    .query(Q.where('owner_id', ownerId), Q.sortBy('created_at', Q.desc))
    .observeWithColumns(['name', 'code', 'area', 'status', 'variety_name', 'updated_at']);
}

export function observePlot(plotId: string) {
  return collections.plots.findAndObserve(plotId);
}

export async function existingPlotCodes(): Promise<string[]> {
  const rows = await collections.plots.query().fetch();
  return rows.map(p => p.code);
}

/** Resolves the code to save: what the farmer typed, or a fresh generated one. */
export async function resolvePlotCode(typed: string): Promise<string> {
  const trimmed = typed.trim().toUpperCase();
  if (trimmed) return trimmed;
  return generateUniquePlotCode(await existingPlotCodes());
}

/**
 * Creates a plot LOCALLY and returns immediately (Điều 1).
 * Nothing here touches the network — the sync adapter picks the row up later.
 */
export async function createPlot(input: PlotInput, author: ChangeAuthor): Promise<Plot> {
  let created!: Plot;

  await database.write(async () => {
    created = collections.plots.prepareCreate(plot => {
      plot.code = input.code;
      plot.name = input.name;
      plot.region = input.region;
      plot.area = input.area;
      plot.areaUnit = input.areaUnit;
      plot.cropType = input.cropType;
      plot.varietyId = input.varietyId;
      plot.varietyName = input.varietyName;
      plot.plantedAt = input.plantedAt;
      plot.status = input.status;
      plot.notes = input.notes;
      plot.ownerId = author.id;
      plot.updatedBy = author.id;
    });

    const logs = prepareChangeLogs('plots', created.id, 'create', author, [
      {field: 'name', label: FIELD_LABELS.name, oldValue: null, newValue: input.name},
    ]);

    await database.batch(created, ...logs);
  });

  return created;
}

/** Updates a plot locally and records one audit row per changed field. */
export async function updatePlot(
  plot: Plot,
  input: PlotInput,
  author: ChangeAuthor,
): Promise<void> {
  const changes = diffPlot(plot, input);

  await database.write(async () => {
    const updated = plot.prepareUpdate(p => {
      p.code = input.code;
      p.name = input.name;
      p.region = input.region;
      p.area = input.area;
      p.areaUnit = input.areaUnit;
      p.cropType = input.cropType;
      p.varietyId = input.varietyId;
      p.varietyName = input.varietyName;
      p.plantedAt = input.plantedAt;
      p.status = input.status;
      p.notes = input.notes;
      p.updatedBy = author.id;
    });

    if (changes.length === 0) {
      await database.batch(updated);
      return;
    }

    const logs = prepareChangeLogs('plots', plot.id, 'update', author, changes);
    await database.batch(updated, ...logs);
  });
}

/**
 * Soft-deletes locally. `markAsDeleted` keeps the row in the sync outbox so the
 * server learns about the deletion; `destroyPermanently` would lose that.
 */
export async function deletePlot(plot: Plot, author: ChangeAuthor): Promise<void> {
  await database.write(async () => {
    const logs = prepareChangeLogs('plots', plot.id, 'delete', author, [
      {field: 'name', label: FIELD_LABELS.name, oldValue: plot.name, newValue: null},
    ]);
    await database.batch(...logs);
    await plot.markAsDeleted();
  });
}

function diffPlot(plot: Plot, input: PlotInput): FieldChange[] {
  const before: Record<string, string | null> = {
    code: plot.code,
    name: plot.name,
    region: plot.region,
    area: formatArea(plot.area, plot.areaUnit),
    cropType: plot.cropType,
    varietyName: plot.varietyName,
    plantedAt: plot.plantedAt ? formatDate(plot.plantedAt) : null,
    status: PLOT_STATUS_LABELS[plot.status],
    notes: plot.notes,
  };
  const after: Record<string, string | null> = {
    code: input.code,
    name: input.name,
    region: input.region,
    area: formatArea(input.area, input.areaUnit),
    cropType: input.cropType,
    varietyName: input.varietyName,
    plantedAt: input.plantedAt ? formatDate(input.plantedAt) : null,
    status: PLOT_STATUS_LABELS[input.status],
    notes: input.notes,
  };

  return Object.keys(after)
    .filter(key => (before[key] ?? '') !== (after[key] ?? ''))
    .map(key => ({
      field: key,
      label: FIELD_LABELS[key as keyof PlotInput] ?? key,
      oldValue: before[key],
      newValue: after[key],
    }));
}

export function plotToInput(plot: Plot): PlotInput {
  return {
    code: plot.code,
    name: plot.name,
    region: plot.region,
    area: plot.area,
    areaUnit: plot.areaUnit,
    cropType: plot.cropType,
    varietyId: plot.varietyId,
    varietyName: plot.varietyName,
    plantedAt: plot.plantedAt,
    status: plot.status,
    notes: plot.notes,
  };
}
