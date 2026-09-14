import {Model} from '@nozbe/watermelondb';
import {date, field, readonly, text} from '@nozbe/watermelondb/decorators';

/** One care task the farmer ticked off (or set a reminder on) — F5/F6. */
export default class TaskHistory extends Model {
  static table = 'tasks_history';

  @text('protocol_id') protocolId!: string;
  @text('stage_code') stageCode!: string;
  @text('task_key') taskKey!: string;
  @text('task_title') taskTitle!: string;
  @text('crop_type') cropType!: string;
  @text('plot_id') plotId!: string | null;
  @field('done') done!: boolean;
  @field('done_at') doneAt!: number | null;
  @field('remind_at') remindAt!: number | null;
  @text('note') note!: string | null;
  @text('owner_id') ownerId!: string;
  @text('updated_by') updatedBy!: string | null;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}
