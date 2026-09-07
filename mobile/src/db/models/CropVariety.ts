import {Model} from '@nozbe/watermelondb';
import {date, field, readonly, text} from '@nozbe/watermelondb/decorators';

/**
 * Crop varieties are an OPEN catalogue: seeded from shared/data/crop_varieties.json
 * but extendable by farmers through "+ Thêm giống mới". A user-added variety is
 * written locally first (Điều 1) and shared with the rest of the system on the
 * next sync, where an admin can approve it.
 */
export default class CropVariety extends Model {
  static table = 'crop_varieties';

  /** Stable key from the seed file; null for varieties the farmer typed in. */
  @text('seed_key') seedKey!: string | null;
  @text('name') name!: string;
  @text('crop_type') cropType!: string;
  @text('crop_name') cropName!: string;
  @text('fruit') fruit!: string | null;
  @text('usage') usage!: string | null;
  @text('note') note!: string | null;
  @field('is_seed') isSeed!: boolean;
  @field('approved') approved!: boolean;
  @text('source') source!: string;
  @text('created_by') createdBy!: string | null;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}
