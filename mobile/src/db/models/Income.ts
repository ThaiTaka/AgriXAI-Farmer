import {Model} from '@nozbe/watermelondb';
import {date, field, readonly, text} from '@nozbe/watermelondb/decorators';

export type IncomeKind = 'product' | 'service' | 'other';

export default class Income extends Model {
  static table = 'income';

  @text('kind') kind!: IncomeKind;
  @text('description') description!: string;
  @field('amount') amount!: number;
  @field('occurred_at') occurredAt!: number;
  @text('note') note!: string | null;
  @text('plot_id') plotId!: string | null;
  /** "Đã kiểm tra" — the farmer has reconciled this line. */
  @field('checked') checked!: boolean;
  @text('owner_id') ownerId!: string;
  @text('updated_by') updatedBy!: string | null;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}
