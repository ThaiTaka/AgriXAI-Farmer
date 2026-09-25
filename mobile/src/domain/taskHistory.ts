/**
 * Lịch sử công việc — every task of a plot's care protocol, split into what is
 * still to do and what was done, with what the farmer recorded on each (notes,
 * photos, hired labour).
 *
 * This is the *task* history. What was grown and harvested on the plot is the
 * cultivation history (domain/cultivation.ts); the two are kept apart on
 * purpose — "đã bón thúc lần 1" and "vụ Xuân được 1,4 tấn" answer different
 * questions.
 */

import type {CareProtocol, CareStage, CareTask} from './careProtocol';
import {parseMediaRefs} from './media';

export interface TaskRowLike {
  id: string;
  stageCode: string;
  taskKey: string;
  done: boolean;
  doneAt: number | null;
}

export interface NoteLike {
  taskId: string;
  mediaJson: string | null;
}

export interface LaborLike {
  taskId: string | null;
  amount: number;
}

export interface TaskHistoryItem {
  stage: CareStage;
  stageIndex: number;
  task: CareTask;
  /** The tasks_history row, once the farmer ticked, noted or costed the task. */
  rowId: string | null;
  done: boolean;
  doneAt: number | null;
  notes: number;
  media: number;
  laborTotal: number;
}

export interface TaskHistory {
  pending: TaskHistoryItem[];
  done: TaskHistoryItem[];
}

export function taskHistoryFor(
  protocol: CareProtocol,
  rows: readonly TaskRowLike[],
  notes: readonly NoteLike[] = [],
  labor: readonly LaborLike[] = [],
): TaskHistory {
  const byKey = new Map(rows.map(r => [`${r.stageCode}/${r.taskKey}`, r]));
  const notesBy = new Map<string, {notes: number; media: number}>();
  for (const n of notes) {
    const tally = notesBy.get(n.taskId) ?? {notes: 0, media: 0};
    tally.notes += 1;
    tally.media += parseMediaRefs(n.mediaJson).length;
    notesBy.set(n.taskId, tally);
  }
  const laborBy = new Map<string, number>();
  for (const l of labor) {
    if (l.taskId) laborBy.set(l.taskId, (laborBy.get(l.taskId) ?? 0) + l.amount);
  }

  const items: TaskHistoryItem[] = [];
  protocol.stages.forEach((stage, stageIndex) => {
    for (const task of stage.tasks) {
      const row = byKey.get(`${stage.stage_code}/${task.key}`) ?? null;
      const tally = row ? notesBy.get(row.id) : undefined;
      items.push({
        stage,
        stageIndex,
        task,
        rowId: row?.id ?? null,
        done: row?.done ?? false,
        doneAt: row?.done ? row.doneAt : null,
        notes: tally?.notes ?? 0,
        media: tally?.media ?? 0,
        laborTotal: row ? (laborBy.get(row.id) ?? 0) : 0,
      });
    }
  });

  return {
    // Protocol order: the next job is the first one listed.
    pending: items.filter(i => !i.done),
    // Most recent first: "what did I do last?" is the usual question.
    done: items.filter(i => i.done).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0)),
  };
}

/** "2 ghi chú · 3 ảnh/video · 60.000₫ tiền công" — without the zeros. */
export function describeRecords(item: Pick<TaskHistoryItem, 'notes' | 'media' | 'laborTotal'>, money: (v: number) => string): string | null {
  const parts = [
    item.notes ? `${item.notes} ghi chú` : null,
    item.media ? `${item.media} ảnh/video` : null,
    item.laborTotal ? `${money(item.laborTotal)} tiền công` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}
