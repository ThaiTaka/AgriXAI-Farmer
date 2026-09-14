import {Model} from '@nozbe/watermelondb';
import {date, field, readonly, text} from '@nozbe/watermelondb/decorators';

export type StockUnit = 'kg' | 'tan';

/** A purchase lot: what came into the shed, when, and at what price per kg. */
export default class WarehouseIn extends Model {
  static table = 'warehouse_in';

  @text('fertilizer_id') fertilizerId!: string;
  @text('fertilizer_name') fertilizerName!: string;
  @text('category') category!: string | null;
  /** As typed by the farmer, in `unit`. */
  @field('quantity') quantity!: number;
  @text('unit') unit!: StockUnit;
  @field('quantity_kg') quantityKg!: number;
  /** Total paid for the lot, in đồng. */
  @field('price') price!: number;
  /** price / quantity_kg. */
  @field('unit_price') unitPrice!: number;
  @field('occurred_at') occurredAt!: number;
  @text('note') note!: string | null;
  @text('plot_id') plotId!: string | null;
  @text('expense_id') expenseId!: string | null;
  @text('owner_id') ownerId!: string;
  @text('updated_by') updatedBy!: string | null;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}
