import {Model} from '@nozbe/watermelondb';
import {date, field, readonly, text} from '@nozbe/watermelondb/decorators';

/**
 * How a care task was actually done on this plot — words, photos, a video —
 * kept for next season. `taskId` is the tasks_history row; photos and videos
 * are media refs in `mediaJson` (domain/media.ts), the files themselves live
 * in the app's documents folder until uploaded.
 */
export default class TaskNote extends Model {
  static table = 'task_notes';

  @text('task_id') taskId!: string;
  @text('plot_id') plotId!: string | null;
  @text('note_text') noteText!: string;
  @text('media_json') mediaJson!: string | null;
  @field('occurred_at') occurredAt!: number;
  @text('owner_id') ownerId!: string;
  @text('updated_by') updatedBy!: string | null;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}
