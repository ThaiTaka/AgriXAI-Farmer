import {Model} from '@nozbe/watermelondb';
import {date, field, readonly, text} from '@nozbe/watermelondb/decorators';

/**
 * A caught screen error, kept on the device until the phone is online and
 * POST /logs accepts it. Local-only: never pulled, never part of /sync.
 */
export default class ErrorLogEntry extends Model {
  static table = 'error_logs';

  /** Route + what the farmer was doing, e.g. "FertilizerCalculator · Tính lượng cần". */
  @text('action') action!: string;
  @text('message') message!: string;
  @text('stack') stack!: string | null;
  @text('app_version') appVersion!: string | null;
  @text('platform') platform!: string | null;
  @field('occurred_at') occurredAt!: number;
  /** True when the farmer pressed "Báo lỗi" (vs. the automatic queue). */
  @field('reported') reported!: boolean;
  @field('uploaded_at') uploadedAt!: number | null;
  @text('user_id') userId!: string;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}
