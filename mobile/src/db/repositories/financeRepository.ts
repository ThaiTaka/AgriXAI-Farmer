import {Q} from '@nozbe/watermelondb';

import type {ExpenseKind, IncomeKind} from '../../domain/finance';
import type {LedgerEntry} from '../../domain/finance';
import {collections, database} from '..';
import type Expense from '../models/Expense';
import type Income from '../models/Income';
import type {ChangeAuthor} from './changeLogRepository';
import {prepareChangeLogs} from './changeLogRepository';

export interface IncomeInput {
  kind: IncomeKind;
  description: string;
  amount: number;
  occurredAt: number;
  note: string | null;
  plotId: string | null;
}

export interface ExpenseInput {
  kind: ExpenseKind;
  description: string;
  amount: number;
  occurredAt: number;
  note: string | null;
  plotId: string | null;
  warehouseInId: string | null;
}

export function observeIncome(ownerId: string) {
  return collections.income
    .query(Q.where('owner_id', ownerId), Q.sortBy('occurred_at', Q.desc))
    .observeWithColumns(['amount', 'description', 'checked', 'occurred_at']);
}

export function observeExpense(ownerId: string) {
  return collections.expense
    .query(Q.where('owner_id', ownerId), Q.sortBy('occurred_at', Q.desc))
    .observeWithColumns(['amount', 'description', 'checked', 'occurred_at']);
}

export const toEntries = (rows: readonly (Income | Expense)[]): LedgerEntry[] =>
  rows.map(r => ({
    id: r.id,
    kind: r.kind,
    description: r.description,
    amount: r.amount,
    occurredAt: r.occurredAt,
    note: r.note,
    checked: r.checked,
  }));

export async function addIncome(input: IncomeInput, author: ChangeAuthor): Promise<Income> {
  if (!(input.amount > 0)) throw new Error('Số tiền phải lớn hơn 0');
  let created!: Income;
  await database.write(async () => {
    created = collections.income.prepareCreate(row => {
      row.kind = input.kind;
      row.description = input.description.trim();
      row.amount = input.amount;
      row.occurredAt = input.occurredAt;
      row.note = input.note;
      row.plotId = input.plotId;
      row.checked = false;
      row.ownerId = author.id;
      row.updatedBy = author.id;
    });
    const logs = prepareChangeLogs('income', created.id, 'create', author, [
      {field: 'description', label: 'Khoản thu', oldValue: null, newValue: input.description.trim()},
    ]);
    await database.batch(created, ...logs);
  });
  return created;
}

export async function addExpense(input: ExpenseInput, author: ChangeAuthor): Promise<Expense> {
  if (!(input.amount > 0)) throw new Error('Số tiền phải lớn hơn 0');
  let created!: Expense;
  await database.write(async () => {
    created = collections.expense.prepareCreate(row => {
      row.kind = input.kind;
      row.description = input.description.trim();
      row.amount = input.amount;
      row.occurredAt = input.occurredAt;
      row.note = input.note;
      row.plotId = input.plotId;
      row.checked = false;
      row.warehouseInId = input.warehouseInId;
      row.ownerId = author.id;
      row.updatedBy = author.id;
    });
    const logs = prepareChangeLogs('expense', created.id, 'create', author, [
      {field: 'description', label: 'Khoản chi', oldValue: null, newValue: input.description.trim()},
    ]);
    await database.batch(created, ...logs);
  });
  return created;
}

/** Flip "đã kiểm tra" on a line. */
export async function setChecked(row: Income | Expense, checked: boolean, author: ChangeAuthor): Promise<void> {
  await database.write(async () => {
    const updated = row.prepareUpdate(r => {
      r.checked = checked;
      r.updatedBy = author.id;
    });
    await database.batch(updated);
  });
}

export async function deleteEntry(row: Income | Expense, author: ChangeAuthor): Promise<void> {
  await database.write(async () => {
    const logs = prepareChangeLogs(row.table, row.id, 'delete', author, [
      {field: 'description', label: row.table === 'income' ? 'Khoản thu' : 'Khoản chi', oldValue: row.description, newValue: null},
    ]);
    await database.batch(...logs);
    await row.markAsDeleted();
  });
}
