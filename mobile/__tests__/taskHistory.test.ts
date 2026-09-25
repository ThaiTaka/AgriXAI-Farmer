/**
 * V2.1 — lịch sử công việc của một lô: chưa làm / đã làm, kèm ghi chú và tiền
 * công. Tách khỏi lịch sử trồng trọt (vụ gì, được bao nhiêu kg).
 */

import {allProtocols} from '../src/domain/careProtocol';
import {describeRecords, taskHistoryFor} from '../src/domain/taskHistory';
import {migrations} from '../src/db/migrations';
import {schema, SCHEMA_VERSION, SYNC_TABLES} from '../src/db/schema';
import {formatVnd} from '../src/utils/format';

const protocol = allProtocols().find(p => p.crop_type === 'tomato')!;
const allTasks = protocol.stages.flatMap(s => s.tasks.map(t => ({stage: s.stage_code, key: t.key})));

describe('taskHistoryFor', () => {
  test('every protocol task lands in exactly one list', () => {
    const [first, second] = allTasks;
    const rows = [
      {id: 'r1', stageCode: first.stage, taskKey: first.key, done: true, doneAt: 1_000},
      {id: 'r2', stageCode: second.stage, taskKey: second.key, done: false, doneAt: null},
    ];
    const history = taskHistoryFor(protocol, rows);
    expect(history.pending.length + history.done.length).toBe(allTasks.length);
    expect(history.done.map(i => i.task.key)).toEqual([first.key]);
    // A row that exists but is not ticked (a note was written) is still to do.
    expect(history.pending.find(i => i.task.key === second.key)?.rowId).toBe('r2');
    // Pending stays in protocol order: the next job is listed first.
    expect(history.pending[0].stageIndex).toBeLessThanOrEqual(history.pending[history.pending.length - 1].stageIndex);
  });

  test('done is newest first, with notes, media and labour tallied per task', () => {
    const [a, b] = allTasks;
    const rows = [
      {id: 'old', stageCode: a.stage, taskKey: a.key, done: true, doneAt: 1_000},
      {id: 'new', stageCode: b.stage, taskKey: b.key, done: true, doneAt: 5_000},
    ];
    const notes = [
      {taskId: 'old', mediaJson: '[{"id":"p1","kind":"image"},{"id":"v1","kind":"video"}]'},
      {taskId: 'old', mediaJson: null},
      {taskId: 'someone-else', mediaJson: '[{"id":"x"}]'},
    ];
    const labor = [
      {taskId: 'old', amount: 60_000},
      {taskId: 'old', amount: 40_000},
      {taskId: null, amount: 999},
    ];
    const {done} = taskHistoryFor(protocol, rows, notes, labor);
    expect(done.map(i => i.rowId)).toEqual(['new', 'old']);
    const old = done[1];
    expect([old.notes, old.media, old.laborTotal]).toEqual([2, 2, 100_000]);
    expect(describeRecords(old, formatVnd)).toBe('2 ghi chú · 2 ảnh/video · 100.000₫ tiền công');
    expect(describeRecords(done[0], formatVnd)).toBeNull();
  });
});

describe('schema v7', () => {
  test('bumped, and the new tables sync', () => {
    expect(SCHEMA_VERSION).toBe(7);
    expect(SYNC_TABLES).toEqual(expect.arrayContaining(['task_notes', 'care_guides']));
  });

  test('the v7 migration describes exactly what schema.ts declares', () => {
    // An install upgraded from v6 must end up with the same columns as a fresh
    // v7 install — otherwise a farmer who updates the app loses data the next
    // time a row of the new shape syncs down.
    const step = migrations.sortedMigrations.find(m => m.toVersion === 7)!;
    const columnsOf = (table: string) =>
      Object.keys((schema.tables as Record<string, {columns: Record<string, unknown>}>)[table].columns).sort();

    for (const s of step.steps as {type: string; table?: string; schema?: {name: string; columns: Record<string, unknown>}; columns?: {name: string}[]}[]) {
      if (s.type === 'create_table') {
        expect(Object.keys(s.schema!.columns).sort()).toEqual(columnsOf(s.schema!.name));
      }
      if (s.type === 'add_columns') {
        const added = s.columns!.map(c => c.name);
        expect(columnsOf(s.table!)).toEqual(expect.arrayContaining(added));
      }
    }
    const created = (step.steps as {type: string; schema?: {name: string}}[])
      .filter(s => s.type === 'create_table')
      .map(s => s.schema!.name);
    expect(created.sort()).toEqual(['care_guides', 'task_notes']);
  });
});
