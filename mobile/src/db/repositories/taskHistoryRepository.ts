import {Q} from '@nozbe/watermelondb';

import {collections, database} from '..';
import type TaskHistory from '../models/TaskHistory';
import type {ChangeAuthor} from './changeLogRepository';
import {prepareChangeLogs} from './changeLogRepository';

export interface TaskRef {
  protocolId: string;
  stageCode: string;
  taskKey: string;
  taskTitle: string;
  cropType: string;
  /** null = the protocol viewed on its own, not for a particular plot. */
  plotId: string | null;
}

/** History rows for one protocol, optionally narrowed to a plot. */
export function observeTaskHistory(ownerId: string, protocolId: string, plotId: string | null) {
  const clauses = [Q.where('owner_id', ownerId), Q.where('protocol_id', protocolId)];
  clauses.push(plotId ? Q.where('plot_id', plotId) : Q.where('plot_id', null));
  return collections.tasksHistory.query(...clauses).observeWithColumns(['done', 'done_at', 'remind_at']);
}

/** Reminders that are still ahead, newest first — for the home screen. */
export function observeUpcomingReminders(ownerId: string, now: number = Date.now()) {
  return collections.tasksHistory
    .query(
      Q.where('owner_id', ownerId),
      Q.where('done', false),
      Q.where('remind_at', Q.gte(now - 86_400_000)),
      Q.sortBy('remind_at', Q.asc),
    )
    .observeWithColumns(['done', 'remind_at']);
}

/** Every ticked task of the account — the dashboard subtracts these from the current stages. */
export function observeDoneTasks(ownerId: string) {
  return collections.tasksHistory
    .query(Q.where('owner_id', ownerId), Q.where('done', true))
    .observeWithColumns(['done']);
}

export const historyKey = (stageCode: string, taskKey: string) => `${stageCode}/${taskKey}`;

async function findRow(ownerId: string, ref: TaskRef): Promise<TaskHistory | null> {
  const rows = await collections.tasksHistory
    .query(
      Q.where('owner_id', ownerId),
      Q.where('protocol_id', ref.protocolId),
      Q.where('stage_code', ref.stageCode),
      Q.where('task_key', ref.taskKey),
      ref.plotId ? Q.where('plot_id', ref.plotId) : Q.where('plot_id', null),
    )
    .fetch();
  return rows[0] ?? null;
}

/**
 * Ticks / unticks a task. One row per (protocol, stage, task, plot); the
 * first tick creates it, later ticks update it. The farmer's confirmation
 * IS the tap — nothing here is written automatically.
 */
export async function setTaskDone(ref: TaskRef, done: boolean, author: ChangeAuthor): Promise<void> {
  const existing = await findRow(author.id, ref);
  await database.write(async () => {
    if (existing) {
      const updated = existing.prepareUpdate(r => {
        r.done = done;
        r.doneAt = done ? Date.now() : null;
        r.updatedBy = author.id;
      });
      await database.batch(updated);
      return;
    }
    const created = collections.tasksHistory.prepareCreate(r => {
      r.protocolId = ref.protocolId;
      r.stageCode = ref.stageCode;
      r.taskKey = ref.taskKey;
      r.taskTitle = ref.taskTitle;
      r.cropType = ref.cropType;
      r.plotId = ref.plotId;
      r.done = done;
      r.doneAt = done ? Date.now() : null;
      r.remindAt = null;
      r.note = null;
      r.ownerId = author.id;
      r.updatedBy = author.id;
    });
    const logs = prepareChangeLogs('tasks_history', created.id, 'create', author, [
      {field: 'task_title', label: 'Công việc', oldValue: null, newValue: ref.taskTitle},
    ]);
    await database.batch(created, ...logs);
  });
}

/** Stores a reminder date on the task (null clears it). */
export async function setTaskReminder(ref: TaskRef, remindAt: number | null, author: ChangeAuthor): Promise<void> {
  const existing = await findRow(author.id, ref);
  await database.write(async () => {
    if (existing) {
      const updated = existing.prepareUpdate(r => {
        r.remindAt = remindAt;
        r.updatedBy = author.id;
      });
      await database.batch(updated);
      return;
    }
    const created = collections.tasksHistory.prepareCreate(r => {
      r.protocolId = ref.protocolId;
      r.stageCode = ref.stageCode;
      r.taskKey = ref.taskKey;
      r.taskTitle = ref.taskTitle;
      r.cropType = ref.cropType;
      r.plotId = ref.plotId;
      r.done = false;
      r.doneAt = null;
      r.remindAt = remindAt;
      r.note = null;
      r.ownerId = author.id;
      r.updatedBy = author.id;
    });
    await database.batch(created);
  });
}
