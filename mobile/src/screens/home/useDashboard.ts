import {useMemo} from 'react';

import type Expense from '../../db/models/Expense';
import type Income from '../../db/models/Income';
import type Plot from '../../db/models/Plot';
import type TaskHistory from '../../db/models/TaskHistory';
import type WarehouseIn from '../../db/models/WarehouseIn';
import type WarehouseOut from '../../db/models/WarehouseOut';
import {observeExpense, observeIncome, toEntries} from '../../db/repositories/financeRepository';
import {observePlots} from '../../db/repositories/plotRepository';
import {observeDoneTasks} from '../../db/repositories/taskHistoryRepository';
import {observeWarehouseIn, observeWarehouseOut, toInRows, toOutRows} from '../../db/repositories/warehouseRepository';
import {useObservable, useObservableReady} from '../../db/useObservable';
import type {MonthOverview, PendingGroup, StockOverview} from '../../domain/dashboard';
import {monthOverview, pendingTasks, stockOverview} from '../../domain/dashboard';
import {stockSummary} from '../../domain/warehouse';
import {inferGrowthStage} from '../../utils/growthStage';
import {seedVarietyCategory} from '../../utils/staticData';
import {useVarietyCatalogue} from '../variety/useVarietyCatalogue';

export interface DashboardData {
  stock: StockOverview;
  month: MonthOverview;
  pending: PendingGroup[];
  plots: Plot[];
  /** False cho tới emission đầu tiên — phân biệt "chưa tải" với "không có lô". */
  plotsReady: boolean;
  year: number;
  monthNumber: number;
}

/**
 * Everything the dashboard shows, from local observables — it re-renders the
 * moment a purchase, a sale or a tick is written, online or not.
 */
export function useDashboard(userId: string, now: number = Date.now()): DashboardData {
  const {value: plots, ready: plotsReady} = useObservableReady<Plot[]>(() => observePlots(userId), [userId], []);
  const ins = useObservable<WarehouseIn[]>(() => observeWarehouseIn(userId), [userId], []);
  const outs = useObservable<WarehouseOut[]>(() => observeWarehouseOut(userId), [userId], []);
  const incomes = useObservable<Income[]>(() => observeIncome(userId), [userId], []);
  const expenses = useObservable<Expense[]>(() => observeExpense(userId), [userId], []);
  const done = useObservable<TaskHistory[]>(() => observeDoneTasks(userId), [userId], []);
  const catalogue = useVarietyCatalogue();

  const date = new Date(now);
  const year = date.getFullYear();
  const monthNumber = date.getMonth() + 1;

  const stock = useMemo(() => stockOverview(stockSummary(toInRows(ins), toOutRows(outs))), [ins, outs]);
  const month = useMemo(
    () => monthOverview(toEntries(incomes), toEntries(expenses), year, monthNumber),
    [incomes, expenses, year, monthNumber],
  );
  const pending = useMemo(
    () =>
      pendingTasks(
        plots.map(p => ({
          id: p.id,
          name: p.name,
          cropType: p.cropType,
          cropName: p.cropName,
          categoryId: seedVarietyCategory(p.varietyId) ?? catalogue.find(v => v.id === p.varietyId)?.categoryId ?? null,
          plantedAt: p.plantedAt,
          status: p.status,
        })),
        done.map(d => ({plotId: d.plotId, protocolId: d.protocolId, stageCode: d.stageCode, taskKey: d.taskKey})),
        now,
        (plantedAt, at) => inferGrowthStage(plantedAt, at)?.stage ?? null,
      ),
    [plots, done, catalogue, now],
  );

  return {stock, month, pending, plots, plotsReady, year, monthNumber};
}
