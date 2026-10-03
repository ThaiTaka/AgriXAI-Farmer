import {Model} from '@nozbe/watermelondb';
import {field, readonly, text} from '@nozbe/watermelondb/decorators';

/** The farmer opened a notification. One row per notification, per farm. */
export default class NotificationRead extends Model {
  static table = 'notification_reads';

  @text('notification_id') notificationId!: string;
  @field('read_at') readAt!: number;
  @text('owner_id') ownerId!: string;
  @readonly @field('created_at') createdAt!: number;
  @readonly @field('updated_at') updatedAt!: number;
}
