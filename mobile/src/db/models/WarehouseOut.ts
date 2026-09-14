import {Model} from '@nozbe/watermelondb';
import {date, field, readonly, text} from '@nozbe/watermelondb/decorators';

/** An issue from the shed. Its cost is fixed by FIFO at the time it is written. */
export default class WarehouseOut extends Model {
  static table = 'warehouse_out';

  @text('fertilizer_id') fertilizerId!: string;
  @text('fertilizer_name') fertilizerName!: string;
  @text('category') category!: string | null;
  @field('quantity_kg') quantityKg!: number;
  @field('unit_price') unitPrice!: number;
  @field('total_cost') totalCost!: number;
  @field('occurred_at') occurredAt!: number;
  @text('note') note!: string | null;
  @text('plot_id') plotId!: string | null;
  @text('plan_id') planId!: string | null;
  @text('owner_id') ownerId!: string;
  @text('updated_by') updatedBy!: string | null;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}
