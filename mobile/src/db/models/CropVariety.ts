import {Model} from '@nozbe/watermelondb';
import {date, field, readonly, text} from '@nozbe/watermelondb/decorators';

/** Optional marker shown as a small soft badge in the picker. */
export type VarietyBadge = 'popular' | 'new' | 'premium';

/**
 * Crop varieties are an OPEN catalogue: seeded from shared/data/crop_varieties.json
 * (crop type -> category -> variety) but extendable by farmers through
 * "+ Thêm giống mới". A user-added variety is written locally first (Điều 1)
 * and shared with the rest of the system on the next sync, where an admin can
 * approve it.
 *
 * Crop types and categories are not tables: they are the two static upper
 * levels of the catalogue and only exist here as denormalised ids + names so
 * a row can be shown without the catalogue (e.g. a crop the farmer added).
 */
export default class CropVariety extends Model {
  static table = 'crop_varieties';

  /** Stable key from the seed file; null for varieties the farmer typed in. */
  @text('seed_key') seedKey!: string | null;
  @text('name') name!: string;
  @text('crop_type') cropType!: string;
  @text('crop_name') cropName!: string;
  @text('category_id') categoryId!: string | null;
  @text('category_name') categoryName!: string | null;
  @text('description') description!: string | null;
  @text('usage') usage!: string | null;
  @text('growing_note') growingNote!: string | null;
  @text('badge') badge!: VarietyBadge | null;
  @field('is_seed') isSeed!: boolean;
  @field('approved') approved!: boolean;
  @text('source') source!: string;
  @text('created_by') createdBy!: string | null;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}
