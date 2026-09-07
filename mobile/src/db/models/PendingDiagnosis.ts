import {Model} from '@nozbe/watermelondb';
import {date, field, readonly, text} from '@nozbe/watermelondb/decorators';

export type QueueStatus = 'pending' | 'uploading' | 'failed' | 'done';

/**
 * A leaf photo waiting to be analysed.
 *
 * This is the whole of Điều 3 in one table: taking a photo with no signal writes
 * a row here and the farmer carries on. Nothing blocks, nothing errors. The queue
 * processor drains it when the network returns.
 *
 * LOCAL ONLY — never synced. The `photo_path` points at a file in this app's
 * sandbox and means nothing on another device; what does sync is the `diagnoses`
 * row the upload produces.
 */
export default class PendingDiagnosis extends Model {
  static table = 'pending_diagnoses';

  @text('photo_path') photoPath!: string;
  @text('photo_mime') photoMime!: string;
  @text('plot_id') plotId!: string;
  @text('status') status!: QueueStatus;
  /** Upload attempts so far — drives the backoff and the "thử lại" copy. */
  @field('attempts') attempts!: number;
  @text('last_error') lastError!: string | null;
  /** Set once the upload succeeded and a diagnosis row was written. */
  @text('diagnosis_id') diagnosisId!: string | null;
  @text('owner_id') ownerId!: string;
  @field('synced_at') syncedAt!: number | null;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}
