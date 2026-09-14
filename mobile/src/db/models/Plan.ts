import {Model} from '@nozbe/watermelondb';
import {date, field, readonly, text} from '@nozbe/watermelondb/decorators';

/** One line of a saved plan, as stored in `items_json`. */
export interface PlanItem {
  key: string;
  name: string;
  fertilizer_category: string | null;
  unit: string;
  min: number;
  max: number;
  price_product_id: string | null;
  price_per_kg: number | null;
  cost_min: number | null;
  cost_max: number | null;
}

/** A saved F1 result — the scaled fertiliser list for one area and scenario. */
export default class Plan extends Model {
  static table = 'plans';

  @text('plot_id') plotId!: string | null;
  @text('crop_type') cropType!: string;
  @text('crop_name') cropName!: string | null;
  @text('category_id') categoryId!: string | null;
  @text('variety_id') varietyId!: string | null;
  @text('variety_name') varietyName!: string | null;
  @text('protocol_id') protocolId!: string;
  @text('scenario_id') scenarioId!: string;
  @text('scenario_name') scenarioName!: string;
  @field('area_input') areaInput!: number;
  @text('area_unit') areaUnit!: string;
  @field('area_m2') areaM2!: number;
  @text('items_json') itemsJson!: string;
  @field('cost_min') costMin!: number | null;
  @field('cost_max') costMax!: number | null;
  @text('note') note!: string | null;
  @text('owner_id') ownerId!: string;
  @text('updated_by') updatedBy!: string | null;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  get items(): PlanItem[] {
    try {
      const parsed = JSON.parse(this.itemsJson);
      return Array.isArray(parsed) ? (parsed as PlanItem[]) : [];
    } catch {
      return [];
    }
  }
}
