import {Q} from '@nozbe/watermelondb';

import type {MediaRef} from '../../domain/media';
import {serializeMediaRefs} from '../../domain/media';
import {collections, database} from '..';
import type TaskHistory from '../models/TaskHistory';
import type TaskNote from '../models/TaskNote';
import type {ChangeAuthor} from './changeLogRepository';
import {prepareChangeLogs} from './changeLogRepository';

export interface NoteInput {
  text: string;
  media: readonly MediaRef[];
  occurredAt?: number;
}

export function observeTaskNotes(taskId: string) {
  return collections.taskNotes
    .query(Q.where('task_id', taskId), Q.sortBy('occurred_at', Q.desc))
    .observeWithColumns(['note_text', 'media_json', 'occurred_at']);
}

/** All notes of one plot — for the counts in the task history list. */
export function observePlotNotes(ownerId: string, plotId: string) {
  return collections.taskNotes
    .query(Q.where('owner_id', ownerId), Q.where('plot_id', plotId))
    .observeWithColumns(['media_json']);
}

/** Notes still holding a photo or video the server has not received. */
export function fetchNotesWithPendingMedia(ownerId: string): Promise<TaskNote[]> {
  return collections.taskNotes
    .query(Q.where('owner_id', ownerId), Q.where('media_json', Q.like('%"uploaded":false%')))
    .fetch();
}

export async function addNote(task: TaskHistory, input: NoteInput, author: ChangeAuthor): Promise<TaskNote> {
  const text = input.text.trim();
  if (!text && input.media.length === 0) throw new Error('Ghi chú cần có chữ hoặc ít nhất một ảnh/video.');
  let created!: TaskNote;
  await database.write(async () => {
    created = collections.taskNotes.prepareCreate(note => {
      note.taskId = task.id;
      note.plotId = task.plotId;
      note.noteText = text;
      note.mediaJson = serializeMediaRefs(input.media);
      note.occurredAt = input.occurredAt ?? Date.now();
      note.ownerId = author.id;
      note.updatedBy = author.id;
    });
    const logs = prepareChangeLogs('task_notes', created.id, 'create', author, [
      {field: 'note_text', label: `Ghi chú: ${task.taskTitle}`, oldValue: null, newValue: text || '(ảnh/video)'},
    ]);
    await database.batch(created, ...logs);
  });
  return created;
}

export async function setNoteMedia(note: TaskNote, mediaJson: string | null): Promise<void> {
  await database.write(async () => {
    await database.batch(
      note.prepareUpdate(n => {
        n.mediaJson = mediaJson;
      }),
    );
  });
}

export async function deleteNote(note: TaskNote, author: ChangeAuthor): Promise<void> {
  await database.write(async () => {
    const logs = prepareChangeLogs('task_notes', note.id, 'delete', author, [
      {field: 'note_text', label: 'Ghi chú', oldValue: note.noteText || '(ảnh/video)', newValue: null},
    ]);
    await database.batch(...logs);
    await note.markAsDeleted();
  });
}
