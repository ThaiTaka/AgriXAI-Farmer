import {Q} from '@nozbe/watermelondb';
import {of} from 'rxjs';
import {map} from 'rxjs/operators';

import {diseaseName, severityForDisease} from '../../utils/diseases';
import {collections, database} from '..';
import type Diagnosis from '../models/Diagnosis';
import type PendingDiagnosis from '../models/PendingDiagnosis';
import type {QueueStatus} from '../models/PendingDiagnosis';
import type {ChangeAuthor} from './changeLogRepository';
import {prepareChangeLogs} from './changeLogRepository';

export interface Prediction {
  disease_key: string;
  confidence: number;
}

export interface HeatmapRegion {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  weight?: number;
}

export interface Heatmap {
  regions: HeatmapRegion[];
  affected_ratio?: number | null;
}

export interface DiagnosisResult {
  predictions: Prediction[];
  heatmap: Heatmap | null;
  model_version: string;
  image_path: string;
  analysed_at: number;
}

/* ------------------------------ diagnoses -------------------------------- */

export function observeDiagnoses(plotId: string) {
  return collections.diagnoses
    .query(Q.where('plot_id', plotId), Q.sortBy('diagnosed_at', Q.desc))
    .observeWithColumns(['severity', 'disease_key', 'confidence', 'updated_at']);
}

/**
 * Observes one diagnosis, or emits null when there is no id yet.
 *
 * The null case is real: the result screen mounts before the row exists (a fresh
 * analysis the farmer has not saved, or a photo still in the queue). Calling
 * `findAndObserve` with a placeholder id makes WatermelonDB throw "Record not
 * found" into the subscription instead.
 */
export function observeDiagnosis(id: string | null) {
  if (!id) return of<Diagnosis | null>(null);
  // A query, not `findAndObserve`. The id is minted before the row exists, and
  // `findAndObserve` errors on a missing record — catching that error would end
  // the stream, so the screen would never notice the row being saved a moment
  // later. A query emits [] now and the record when it appears.
  return collections.diagnoses
    .query(Q.where('id', id))
    .observe()
    .pipe(map(rows => rows[0] ?? null));
}

export async function findDiagnosis(id: string): Promise<Diagnosis | null> {
  try {
    return await collections.diagnoses.find(id);
  } catch {
    return null;
  }
}

/** A client-generated diagnosis id. One analysis, one id, decided up front. */
export function newDiagnosisId(): string {
  return `dx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Writes a diagnosis to SQLite. The severity comes from the disease catalogue,
 * which is what colours the plot's health badge on the home list.
 *
 * `input.id` is decided when the analysis starts, not here, so saving the same
 * analysis twice writes the same row instead of two. The result screen then
 * derives "đã lưu" by looking that id up rather than remembering a flag — screen
 * state can survive a navigation and lie; the database cannot.
 */
export async function saveDiagnosis(
  input: {
    id?: string;
    plotId: string;
    result: DiagnosisResult;
    localPhotoPath: string | null;
    diagnosedAt?: number;
  },
  author: ChangeAuthor,
): Promise<Diagnosis> {
  const top = input.result.predictions[0];
  if (!top) throw new Error('saveDiagnosis called without any prediction');

  if (input.id) {
    const already = await findDiagnosis(input.id);
    if (already) return already;
  }

  let created!: Diagnosis;

  await database.write(async () => {
    created = collections.diagnoses.prepareCreate(row => {
      if (input.id) row._raw.id = input.id;
      row.plotId = input.plotId;
      row.diseaseKey = top.disease_key;
      row.diseaseName = diseaseName(top.disease_key);
      row.severity = severityForDisease(top.disease_key);
      row.confidence = top.confidence;
      row.affectedRatio = input.result.heatmap?.affected_ratio ?? null;
      // The local file path: the phone can show the photo again with no network.
      row.imagePath = input.localPhotoPath;
      row.modelVersion = input.result.model_version;
      row.explanation = null;
      row.top3Json = JSON.stringify(input.result.predictions);
      row.heatmapJson = input.result.heatmap ? JSON.stringify(input.result.heatmap) : null;
      row.queued = false;
      row.diagnosedAt = input.diagnosedAt ?? input.result.analysed_at ?? Date.now();
      row.ownerId = author.id;
      row.updatedBy = author.id;
    });

    const logs = prepareChangeLogs('diagnoses', created.id, 'create', author, [
      {
        field: 'disease_key',
        label: 'Kết quả chẩn đoán',
        oldValue: null,
        newValue: diseaseName(top.disease_key),
      },
    ]);

    await database.batch(created, ...logs);
  });

  return created;
}

export async function deleteDiagnosis(row: Diagnosis, author: ChangeAuthor): Promise<void> {
  await database.write(async () => {
    const logs = prepareChangeLogs('diagnoses', row.id, 'delete', author, [
      {field: 'disease_key', label: 'Kết quả chẩn đoán', oldValue: row.diseaseName, newValue: null},
    ]);
    await database.batch(...logs);
    // markAsDeleted, not destroyPermanently: the server has to learn about it.
    await row.markAsDeleted();
  });
}

export function parsePredictions(row: Diagnosis): Prediction[] {
  if (!row.top3Json) {
    return [{disease_key: row.diseaseKey, confidence: row.confidence}];
  }
  try {
    return JSON.parse(row.top3Json) as Prediction[];
  } catch {
    return [{disease_key: row.diseaseKey, confidence: row.confidence}];
  }
}

export function parseHeatmap(row: Diagnosis): Heatmap | null {
  if (!row.heatmapJson) return null;
  try {
    return JSON.parse(row.heatmapJson) as Heatmap;
  } catch {
    return null;
  }
}

/* --------------------------- the upload queue ----------------------------- */

export function observePendingQueue(ownerId: string) {
  return collections.pendingDiagnoses
    .query(
      Q.where('owner_id', ownerId),
      Q.where('status', Q.notEq('done')),
      Q.sortBy('created_at', Q.asc),
    )
    .observeWithColumns(['status', 'attempts', 'last_error']);
}

/** Observes one queue row, or emits null when this screen has no queued photo. */
export function observePending(id: string | null) {
  if (!id) return of<PendingDiagnosis | null>(null);
  // Same reasoning as observeDiagnosis, plus: this row is deleted once its photo
  // has been analysed, and a query reports that as [] instead of erroring.
  return collections.pendingDiagnoses
    .query(Q.where('id', id))
    .observe()
    .pipe(map(rows => rows[0] ?? null));
}

/** Photos still waiting, oldest first — the order the processor drains them in. */
export async function claimableQueue(ownerId: string): Promise<PendingDiagnosis[]> {
  return collections.pendingDiagnoses
    .query(
      Q.where('owner_id', ownerId),
      Q.where('status', Q.oneOf(['pending', 'failed'])),
      Q.sortBy('created_at', Q.asc),
    )
    .fetch();
}

export async function enqueuePhoto(
  input: {photoPath: string; photoMime: string; plotId: string},
  author: ChangeAuthor,
): Promise<PendingDiagnosis> {
  let created!: PendingDiagnosis;

  await database.write(async () => {
    created = collections.pendingDiagnoses.prepareCreate(row => {
      row.photoPath = input.photoPath;
      row.photoMime = input.photoMime;
      row.plotId = input.plotId;
      row.status = 'pending';
      row.attempts = 0;
      row.lastError = null;
      row.diagnosisId = null;
      row.ownerId = author.id;
      row.syncedAt = null;
    });
    await database.batch(created);
  });

  return created;
}

export async function markQueueStatus(
  row: PendingDiagnosis,
  status: QueueStatus,
  extra: {lastError?: string | null; diagnosisId?: string | null; bumpAttempts?: boolean} = {},
): Promise<void> {
  await database.write(async () => {
    await row.update(entry => {
      entry.status = status;
      if (extra.bumpAttempts) entry.attempts = entry.attempts + 1;
      if (extra.lastError !== undefined) entry.lastError = extra.lastError;
      if (extra.diagnosisId !== undefined) entry.diagnosisId = extra.diagnosisId;
      if (status === 'done') entry.syncedAt = Date.now();
    });
  });
}

/** Puts a stuck photo back in line: clears the failure and the attempt count. */
export async function resetQueueRow(row: PendingDiagnosis): Promise<void> {
  await database.write(async () => {
    await row.update(entry => {
      entry.status = 'pending';
      entry.attempts = 0;
      entry.lastError = null;
    });
  });
}

/**
 * Removes a finished queue row.
 *
 * `destroyPermanently`, not `markAsDeleted`: the queue never leaves the device,
 * so there is no server that needs to hear about the deletion, and keeping
 * tombstones for local rows would grow the table forever.
 */
export async function dropQueueRow(row: PendingDiagnosis): Promise<void> {
  await database.write(async () => {
    await row.destroyPermanently();
  });
}
