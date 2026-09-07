import {Model} from '@nozbe/watermelondb';
import {date, field, readonly, text} from '@nozbe/watermelondb/decorators';

export type ChangeAction = 'create' | 'update' | 'delete';

/**
 * Audit trail behind the "Lịch sử thay đổi" tab: who changed which field, when.
 * Written in the same local transaction as the change itself, so the log is
 * complete even when the device never goes online.
 */
export default class ChangeLog extends Model {
  static table = 'change_logs';

  @text('table_name') tableName!: string;
  @text('record_id') recordId!: string;
  @text('action') action!: ChangeAction;
  @text('field') fieldName!: string | null;
  @text('old_value') oldValue!: string | null;
  @text('new_value') newValue!: string | null;
  @text('changed_by') changedBy!: string;
  @text('changed_by_name') changedByName!: string | null;
  @field('changed_at') changedAt!: number;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}
