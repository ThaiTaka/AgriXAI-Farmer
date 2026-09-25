import {Q} from '@nozbe/watermelondb';

import type {InRow, OutRow, StockUnit} from '../../domain/warehouse';
import {fifoCost, stockOf, toKg} from '../../domain/warehouse';
import {collections, database} from '..';
import type WarehouseIn from '../models/WarehouseIn';
import type WarehouseOut from '../models/WarehouseOut';
import type {ChangeAuthor} from './changeLogRepository';
import {prepareChangeLogs} from './changeLogRepository';

export interface StockInInput {
  fertilizerId: string;
  fertilizerName: string;
  category: string | null;
  quantity: number;
  unit: StockUnit;
  /** Total paid for the lot, đồng. */
  price: number;
  occurredAt: number;
  note: string | null;
  plotId: string | null;
  /** Book the purchase as a "Phân bón" expense too (default: yes). */
  recordExpense: boolean;
}

export interface StockOutInput {
  fertilizerId: string;
  fertilizerName: string;
  category: string | null;
  quantityKg: number;
  occurredAt: number;
  note: string | null;
  plotId: string | null;
  planId: string | null;
}

export class InsufficientStockError extends Error {
  constructor(
    readonly stockKg: number,
    readonly neededKg: number,
    readonly fertilizerName: string,
  ) {
    super(`Kho chỉ còn ${stockKg} kg ${fertilizerName}, không xuất được ${neededKg} kg`);
    this.name = 'InsufficientStockError';
  }
}

export function observeWarehouseIn(ownerId: string) {
  return collections.warehouseIn
    .query(Q.where('owner_id', ownerId), Q.sortBy('occurred_at', Q.desc))
    .observeWithColumns(['quantity_kg', 'price', 'occurred_at', 'note']);
}

export function observeWarehouseOut(ownerId: string) {
  return collections.warehouseOut
    .query(Q.where('owner_id', ownerId), Q.sortBy('occurred_at', Q.desc))
    .observeWithColumns(['quantity_kg', 'total_cost', 'occurred_at', 'note']);
}

/** Stock issued onto one plot — its fertiliser cost at FIFO prices. */
export function observePlotIssues(ownerId: string, plotId: string) {
  return collections.warehouseOut
    .query(Q.where('owner_id', ownerId), Q.where('plot_id', plotId))
    .observeWithColumns(['total_cost', 'occurred_at']);
}

/** Model rows → the plain shapes the domain functions take. */
export const toInRows = (rows: readonly WarehouseIn[]): InRow[] =>
  rows.map(r => ({
    id: r.id,
    fertilizerId: r.fertilizerId,
    fertilizerName: r.fertilizerName,
    category: r.category,
    quantityKg: r.quantityKg,
    unitPrice: r.unitPrice,
    occurredAt: r.occurredAt,
    createdAt: r.createdAt.getTime(),
  }));

export const toOutRows = (rows: readonly WarehouseOut[]): OutRow[] =>
  rows.map(r => ({
    id: r.id,
    fertilizerId: r.fertilizerId,
    fertilizerName: r.fertilizerName,
    category: r.category,
    quantityKg: r.quantityKg,
    unitPrice: r.unitPrice,
    totalCost: r.totalCost,
    occurredAt: r.occurredAt,
    createdAt: r.createdAt.getTime(),
  }));

/**
 * Books a purchase. The stock row and (optionally) the matching expense are
 * written in ONE transaction and cross-linked, so the shed and the ledger
 * can never disagree about a purchase.
 */
export async function addStockIn(input: StockInInput, author: ChangeAuthor): Promise<WarehouseIn> {
  const quantityKg = toKg(input.quantity, input.unit);
  if (!(quantityKg > 0)) throw new Error('Lượng nhập phải lớn hơn 0');
  const unitPrice = input.price / quantityKg;

  let created!: WarehouseIn;
  await database.write(async () => {
    const batch = [];
    created = collections.warehouseIn.prepareCreate(row => {
      row.fertilizerId = input.fertilizerId;
      row.fertilizerName = input.fertilizerName;
      row.category = input.category;
      row.quantity = input.quantity;
      row.unit = input.unit;
      row.quantityKg = quantityKg;
      row.price = input.price;
      row.unitPrice = unitPrice;
      row.occurredAt = input.occurredAt;
      row.note = input.note;
      row.plotId = input.plotId;
      row.expenseId = null;
      row.ownerId = author.id;
      row.updatedBy = author.id;
    });
    batch.push(created);

    if (input.recordExpense && input.price > 0) {
      const expense = collections.expense.prepareCreate(row => {
        row.kind = 'fertilizer';
        row.description = `Mua ${input.fertilizerName} ${formatQty(input.quantity)} ${input.unit === 'tan' ? 'tấn' : 'kg'}`;
        row.amount = input.price;
        row.occurredAt = input.occurredAt;
        row.note = input.note;
        row.plotId = input.plotId;
        row.checked = false;
        row.warehouseInId = created.id;
        row.ownerId = author.id;
        row.updatedBy = author.id;
      });
      created.expenseId = expense.id;
      batch.push(expense);
    }

    batch.push(
      ...prepareChangeLogs('warehouse_in', created.id, 'create', author, [
        {field: 'fertilizer_name', label: 'Nhập kho', oldValue: null, newValue: `${input.fertilizerName} ${formatQty(quantityKg)} kg`},
      ]),
    );
    await database.batch(...batch);
  });
  return created;
}

/**
 * Issues stock. Refuses when the shed does not hold enough; prices the issue
 * by FIFO over the purchase lots on the device at that moment.
 */
export async function addStockOut(input: StockOutInput, author: ChangeAuthor): Promise<WarehouseOut> {
  if (!(input.quantityKg > 0)) throw new Error('Lượng xuất phải lớn hơn 0');

  const ins = toInRows(await collections.warehouseIn.query(Q.where('owner_id', author.id)).fetch());
  const outs = toOutRows(await collections.warehouseOut.query(Q.where('owner_id', author.id)).fetch());
  const stock = stockOf(ins, outs, input.fertilizerId);
  if (input.quantityKg > stock + 1e-9) {
    throw new InsufficientStockError(stock, input.quantityKg, input.fertilizerName);
  }
  const fifo = fifoCost(ins, outs, input.fertilizerId, input.quantityKg, input.occurredAt);

  let created!: WarehouseOut;
  await database.write(async () => {
    created = collections.warehouseOut.prepareCreate(row => {
      row.fertilizerId = input.fertilizerId;
      row.fertilizerName = input.fertilizerName;
      row.category = input.category;
      row.quantityKg = input.quantityKg;
      row.unitPrice = fifo.unitPrice;
      row.totalCost = fifo.totalCost;
      row.occurredAt = input.occurredAt;
      row.note = input.note;
      row.plotId = input.plotId;
      row.planId = input.planId;
      row.ownerId = author.id;
      row.updatedBy = author.id;
    });
    const logs = prepareChangeLogs('warehouse_out', created.id, 'create', author, [
      {field: 'fertilizer_name', label: 'Xuất kho', oldValue: null, newValue: `${input.fertilizerName} ${formatQty(input.quantityKg)} kg`},
    ]);
    await database.batch(created, ...logs);
  });
  return created;
}

export async function deleteStockRow(row: WarehouseIn | WarehouseOut, author: ChangeAuthor): Promise<void> {
  await database.write(async () => {
    const logs = prepareChangeLogs(row.table, row.id, 'delete', author, [
      {field: 'fertilizer_name', label: 'Phiếu kho', oldValue: row.fertilizerName, newValue: null},
    ]);
    await database.batch(...logs);
    await row.markAsDeleted();
  });
}

function formatQty(value: number): string {
  return new Intl.NumberFormat('vi-VN', {maximumFractionDigits: 2}).format(value);
}
