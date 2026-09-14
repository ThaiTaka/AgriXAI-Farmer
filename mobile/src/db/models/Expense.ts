import {Model} from '@nozbe/watermelondb';
import {date, field, readonly, text} from '@nozbe/watermelondb/decorators';

export type ExpenseKind = 'fertilizer' | 'labor' | 'utilities' | 'other';

export default class Expense extends Model {
  static table = 'expense';

  @text('kind') kind!: ExpenseKind;
  @text('description') description!: string;
  @field('amount') amount!: number;
  @field('occurred_at') occurredAt!: number;
  @text('note') note!: string | null;
  @text('plot_id') plotId!: string | null;
  @field('checked') checked!: boolean;
  /** Set when the expense was booked automatically from a stock purchase. */
  @text('warehouse_in_id') warehouseInId!: string | null;
  @text('owner_id') ownerId!: string;
  @text('updated_by') updatedBy!: string | null;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}
