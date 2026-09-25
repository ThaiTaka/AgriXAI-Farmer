import {Model} from '@nozbe/watermelondb';
import {date, field, readonly, text} from '@nozbe/watermelondb/decorators';

/**
 * A crop how-to written by an admin in web-admin: an embedded YouTube video
 * plus illustrated steps. Read-only on the phone — it arrives through /sync
 * and the server refuses any change the phone might push.
 */
export default class CareGuide extends Model {
  static table = 'care_guides';

  @text('crop_type') cropType!: string;
  @text('stage_code') stageCode!: string | null;
  @text('title') title!: string;
  @text('summary') summary!: string | null;
  @text('youtube_id') youtubeId!: string | null;
  /** JSON [{title, body, image_id}] — parse with domain/careGuide.ts. */
  @text('steps_json') stepsJson!: string | null;
  /** JSON [media id] — public pictures. */
  @text('images_json') imagesJson!: string | null;
  @text('source_name') sourceName!: string | null;
  @text('source_url') sourceUrl!: string | null;
  @field('published') published!: boolean;
  @field('sort_order') sortOrder!: number;
  @text('created_by') createdBy!: string | null;
  @text('updated_by') updatedBy!: string | null;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}
