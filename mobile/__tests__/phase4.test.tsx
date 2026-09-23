/**
 * Giai đoạn 4 — dashboard figures, offline/sync wording, error records,
 * the PDF report builder, and the three new presentational pieces.
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

import {DashboardCard} from '../src/components/DashboardCard';
import {monthOverview, pendingSubtext, pendingTasks, pendingTotal, stockOverview} from '../src/domain/dashboard';
import {describeAction, friendlyDetail, toErrorRecord} from '../src/domain/errorLog';
import {financialReport, type LedgerEntry} from '../src/domain/finance';
import {isEmptyReport, noteLines, reportFileName, reportHtml, reportNotes, trailingWindow} from '../src/domain/reportPdf';
import {ageLabel, bannerFor, clockLabel, conflictTitle, tableStatusLine} from '../src/domain/syncStatus';
import {stockSummary} from '../src/domain/warehouse';
import {formatDate, formatVnd} from '../src/utils/format';
import {inferGrowthStage} from '../src/utils/growthStage';

const day = (iso: string, hour = 8) => new Date(`${iso}T${String(hour).padStart(2, '0')}:00:00+07:00`).getTime();

// The demo farm: Lê Thành Thái, PUC-001-HB.
const INS = [
  {fertilizerId: 'ure_ca_mau', fertilizerName: 'Urê Cà Mau', category: 'dam', quantityKg: 50, unitPrice: 13_600, occurredAt: day('2026-09-10')},
  {fertilizerId: 'dap_han_quoc', fertilizerName: 'DAP Hàn Quốc (nhập khẩu)', category: 'lan', quantityKg: 50, unitPrice: 22_000, occurredAt: day('2026-09-10')},
];
const OUTS = [
  {fertilizerId: 'ure_ca_mau', fertilizerName: 'Urê Cà Mau', category: 'dam', quantityKg: 20, unitPrice: 13_600, totalCost: 272_000, occurredAt: day('2026-09-14')},
];
const INCOMES: LedgerEntry[] = [
  {kind: 'product', description: 'Bán cà chua MV1 50kg', amount: 1_500_000, occurredAt: day('2026-09-01'), note: 'Bán cho cửa hàng Kim Hạnh', checked: true},
];
const EXPENSES: LedgerEntry[] = [
  {kind: 'labor', description: 'Công bón phân (3 công)', amount: 300_000, occurredAt: day('2026-09-05')},
  {kind: 'utilities', description: 'Điện nước', amount: 120_000, occurredAt: day('2026-09-10')},
  {kind: 'fertilizer', description: 'Mua Urê Cà Mau 50 kg', amount: 680_000, occurredAt: day('2026-09-10')},
  {kind: 'fertilizer', description: 'Mua DAP Hàn Quốc (nhập khẩu) 50 kg', amount: 1_100_000, occurredAt: day('2026-09-10')},
  {kind: 'fertilizer', description: 'Mua kali tháng 7', amount: 300_000, occurredAt: day('2026-07-20')},
];

/* ------------------------------- dashboard ------------------------------- */

describe('dashboard', () => {
  test('tồn kho: value = Σ stock × avg price, kinds and kg from lines with stock', () => {
    const stock = stockOverview(stockSummary(INS, OUTS));
    expect(stock.kinds).toBe(2);
    expect(stock.kg).toBe(80);
    expect(stock.value).toBe(30 * 13_600 + 50 * 22_000); // 1.508.000
  });

  test('tháng này: lãi/lỗ = thu − chi of the calendar month', () => {
    const month = monthOverview(INCOMES, EXPENSES, 2026, 9);
    expect(month.income).toBe(1_500_000);
    expect(month.expense).toBe(2_200_000);
    expect(month.profit).toBe(-700_000);
    expect(monthOverview(INCOMES, EXPENSES, 2026, 7).expense).toBe(300_000);
  });

  test('công việc: pending = tasks of the current stage without a done row', () => {
    const now = day('2026-09-14');
    const infer = (plantedAt: number | null, at: number) => inferGrowthStage(plantedAt, at)?.stage ?? null;
    const plots = [
      {id: 'p1', name: 'Ruộng cà chua', cropType: 'tomato', cropName: 'Cà chua', categoryId: 'tomato_round', plantedAt: day('2026-08-20'), status: 'active'},
      {id: 'p2', name: 'Vườn ớt', cropType: 'chili', cropName: 'Ớt', categoryId: 'chili_chi_thien', plantedAt: day('2026-08-10'), status: 'active'},
      {id: 'p3', name: 'Bỏ hoá', cropType: 'tomato', cropName: 'Cà chua', categoryId: null, plantedAt: day('2026-08-01'), status: 'fallow'},
      {id: 'p4', name: 'Cà phê mít', cropType: 'coffee', cropName: 'Cà phê', categoryId: 'coffee_liberica', plantedAt: null, status: 'active'},
    ];
    const none = pendingTasks(plots, [], now, infer);
    expect(none.map(g => [g.plotId, g.stageName, g.pending])).toEqual([
      ['p1', 'Ra hoa đợt đầu', 4],
      ['p2', 'Sinh trưởng (20–25 ngày sau trồng)', 3],
    ]);
    expect(pendingTotal(none)).toBe(7);
    expect(pendingSubtext(none)).toBe('Cà chua · Ra hoa đợt đầu: 4; Ớt · Sinh trưởng: 3');

    const done = [{plotId: 'p1', protocolId: 'tomato_default', stageCode: 'flowering', taskKey: 'lam_gian'}];
    const some = pendingTasks(plots, done, now, infer);
    expect(some[0].pending).toBe(3);
    expect(pendingSubtext([])).toBe('Không có việc nào chờ ở giai đoạn hiện tại');
  });

  test('currency and card figures format the Vietnamese way', () => {
    expect(formatVnd(1_500_000)).toBe('1.500.000₫');
    expect(formatVnd(-700_000)).toBe('-700.000₫');
  });

  test('DashboardCard renders label, value, subtext and navigates on press', () => {
    const onPress = jest.fn();
    let tree!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(
        <DashboardCard testID="card" label="Tồn kho" value="1.508.000₫" subtext="2 loại phân bón, 80 kg" onPress={onPress} flag="Chưa đồng bộ" />,
      );
    });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('Tồn kho');
    expect(json).toContain('1.508.000₫');
    expect(json).toContain('2 loại phân bón, 80 kg');
    expect(json).toContain('Chưa đồng bộ');
    const card = tree.root.findAll(n => typeof n.type === 'string' && n.props.testID === 'card')[0];
    ReactTestRenderer.act(() => {
      card.props.onClick?.();
      card.props.onPress?.();
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

/* ------------------------------ error boundary --------------------------- */

describe('error boundary', () => {
  test('records route, message and stack; unknown values are stringified', () => {
    const record = toErrorRecord(new RangeError('Diện tích phải lớn hơn 0'), 'FertilizerCalculator', 'Tính lượng cần', 123);
    expect(record.action).toBe('FertilizerCalculator · Tính lượng cần');
    expect(record.message).toBe('Diện tích phải lớn hơn 0');
    expect(record.stack).toContain('RangeError');
    expect(record.occurredAt).toBe(123);
    expect(toErrorRecord('chuỗi lỗi', 'Warehouse', null, 1).message).toBe('chuỗi lỗi');
    expect(toErrorRecord({code: 7}, 'Finance', null, 1).message).toBe('{"code":7}');
    expect(describeAction('StockCheck')).toBe('StockCheck');
    expect(friendlyDetail('   ')).toBe('Không có thông tin thêm.');
    expect(friendlyDetail('x'.repeat(300))).toHaveLength(200);
  });
});

/* --------------------------------- offline -------------------------------- */

describe('offline indicator', () => {
  test('banner wording per sync state; offline auto-hides after 8 s', () => {
    expect(bannerFor('offline', null)).toEqual({kind: 'offline', text: 'Chế độ offline — thay đổi sẽ lưu khi online', hideAfterMs: 8_000});
    expect(bannerFor('syncing', null)).toEqual({kind: 'syncing', text: 'Đang đồng bộ…', hideAfterMs: null});
    const at = new Date(2026, 8, 14, 14, 35).getTime();
    expect(bannerFor('idle', at)).toEqual({kind: 'synced', text: 'Cập nhật lúc 14:35', hideAfterMs: 3_000});
    expect(bannerFor('idle', null)).toBeNull();
    expect(clockLabel(at)).toBe('14:35');
  });

  test('per-table status: saved on server vs. offline for N hours', () => {
    const now = day('2026-09-14', 14);
    const fmt = (at: number) => `${formatDate(at)} ${clockLabel(at)}`;
    expect(tableStatusLine({table: 'plans', label: 'Kế hoạch bón', pending: 0, oldestPendingAt: null}, day('2026-09-14', 11), now, fmt)).toBe('Đã lưu trên server 14/09/2026 11:00');
    expect(tableStatusLine({table: 'warehouse_out', label: 'Phiếu xuất kho', pending: 3, oldestPendingAt: day('2026-09-14', 11)}, null, now, fmt)).toBe('Offline 3 giờ · 3 thay đổi chờ đồng bộ');
    expect(tableStatusLine({table: 'income', label: 'Khoản thu', pending: 0, oldestPendingAt: null}, null, now, fmt)).toBe('Chưa đồng bộ lần nào');
    expect(ageLabel(now - 25 * 60_000, now)).toBe('25 phút');
    expect(ageLabel(now - 2 * 86_400_000, now)).toBe('2 ngày');
  });

  test('conflict title names the table and the record', () => {
    expect(
      conflictTitle({table: 'plans', id: 'x', server: {scenario_name: 'Phương án 2'}}),
    ).toBe('kế hoạch bón: Phương án 2');
    expect(conflictTitle({table: 'expense', id: 'e1', server: {description: 'Điện nước'}})).toBe('khoản chi: Điện nước');
  });
});

/* ----------------------------------- pdf ---------------------------------- */

describe('pdf report', () => {
  const period = {kind: 'month', year: 2026, month: 9} as const;
  const report = financialReport(INCOMES, EXPENSES, period);
  const notes = reportNotes(report, stockSummary(INS, OUTS), EXPENSES);

  test('a month without data is reported as such', () => {
    const empty = financialReport(INCOMES, EXPENSES, {kind: 'month', year: 2025, month: 1});
    expect(isEmptyReport(empty)).toBe(true);
    expect(isEmptyReport(report)).toBe(false);
  });

  test('notes: fertiliser costs, remaining stock, buffer from the 3-month average', () => {
    expect(notes.fertilizerTotal).toBe(1_780_000);
    expect(notes.stockKg).toBe(80);
    expect(notes.stockValue).toBe(1_508_000);
    expect(trailingWindow(period)).toEqual([new Date(2026, 6, 1).getTime(), new Date(2026, 9, 1).getTime()]);
    expect(notes.avgMonthlyFertilizer).toBeCloseTo(2_080_000 / 3);
    const lines = noteLines(notes, formatVnd);
    expect(lines[0]).toBe('Chi phí phân bón: 680.000₫ + 1.100.000₫ = 1.780.000₫');
    expect(lines[1]).toBe('Còn dư phân bón: 80 kg (2 loại, ≈ 1.508.000₫ theo giá nhập bình quân)');
    expect(lines[2]).toContain('693.333₫');
  });

  test('HTML carries summary, both detail tables, notes, footer and Unicode', () => {
    const html = reportHtml({
      farmerName: 'Lê Thành Thái',
      address: 'Xã Hòa Bình, Huyện Thanh Trì, Hà Nội',
      report,
      notes,
      generatedAt: day('2026-09-14'),
      formatVnd,
      formatDay: formatDate,
    });
    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain('size: A4; margin: 20mm');
    expect(html).toContain('Nông hộ: <strong>Lê Thành Thái</strong>');
    expect(html).toContain('Kỳ: Tháng 9, Năm 2026');
    expect(html).toContain('Lãi/Lỗ [LỖ]');
    expect(html).toContain('−700.000₫');
    expect(html).toContain('<td class="day">01/09</td><td>Bán cà chua MV1 50kg</td><td class="num">1.500.000₫</td>');
    expect(html).toContain('Tổng chi</td><td class="num">2.200.000₫');
    expect(html).toContain('Chi phí phân bón: 680.000₫ + 1.100.000₫ = 1.780.000₫');
    expect(html).toContain('support@agrilog.vn');
    expect(html).not.toContain('<img');
    expect(reportFileName(period)).toBe('bao-cao-thu-chi-2026-thang-9');
    expect(reportFileName({kind: 'quarter', year: 2026, quarter: 3})).toBe('bao-cao-thu-chi-2026-quy-3');
  });

  test('HTML escapes farmer-typed text', () => {
    const html = reportHtml({
      farmerName: 'A <b>B</b> & C',
      address: null,
      report: financialReport([{kind: 'other', description: '<script>alert(1)</script>', amount: 1, occurredAt: day('2026-09-02')}], [], period),
      notes: reportNotes(financialReport([], [], period), [], []),
      generatedAt: day('2026-09-14'),
      formatVnd,
      formatDay: formatDate,
    });
    expect(html).toContain('A &lt;b&gt;B&lt;/b&gt; &amp; C');
    expect(html).not.toContain('<script>');
    expect(html).toContain('Địa chỉ: Chưa cập nhật');
    expect(html).toContain('Không có khoản chi trong kỳ');
  });
});
