import {Model} from '@nozbe/watermelondb';
import {field, readonly, text} from '@nozbe/watermelondb/decorators';

export type NotificationKind = 'announcement' | 'weather' | 'price';
export type NotificationLevel = 'info' | 'warning' | 'danger';

/**
 * A message from the admin or the server (weather warning, price change).
 * Read-only on the phone — it arrives through /sync and the server refuses
 * any change the phone might push. Named AppNotification so it does not
 * shadow the DOM's global `Notification` type.
 */
export default class AppNotification extends Model {
  static table = 'notifications';

  /** null = sent to every farm. */
  @text('owner_id') ownerId!: string | null;
  @text('kind') kind!: NotificationKind;
  @text('level') level!: NotificationLevel;
  @text('title') title!: string;
  @field('body') body!: string;
  /** Where tapping it leads: "weather", "prices", "prices:<id>", "care_guide:<id>". */
  @text('link') link!: string | null;
  @text('source_name') sourceName!: string | null;
  @text('source_url') sourceUrl!: string | null;
  @field('expires_at') expiresAt!: number | null;
  @text('created_by') createdBy!: string | null;
  @readonly @field('created_at') createdAt!: number;
  @readonly @field('updated_at') updatedAt!: number;
}
