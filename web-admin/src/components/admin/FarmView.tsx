"use client";

/**
 * Sổ sách của một nông hộ trên web — cùng ba con số với màn hình chính của
 * ứng dụng điện thoại (tồn kho · tháng này · công việc), kèm bảng tồn kho, thu –
 * chi theo tháng/quý và xuất PDF.
 *
 * Nông hộ xem sổ của chính mình ở /dashboard; quản trị viên xem từng hộ ở
 * /farms/[id]. Quản trị viên còn có Sửa / Xoá trên thu – chi, phiếu nhập – xuất
 * kho và kế hoạch bón phân, để sửa nhầm hoặc trùng lặp của nông hộ ngay trên web
 * thay vì nhờ họ làm lại trên điện thoại.
 */

import {FormEvent, useCallback, useEffect, useMemo, useState} from "react";

import {api, apiBlob, ApiError, formatKg, formatVnd} from "@/lib/api";

import {Icon} from "./Icon";
import {useAdmin} from "./Shell";
import {EmptyState, Field, Kpi, Modal, Notice, Pager, Panel, Pill, TableSkeleton, useConfirm, usePaged} from "./ui";

interface Dashboard {
  owner_id: string;
  full_name: string;
  region: string | null;
  year: number;
  month: number;
  stock_value: number;
  stock_kg: number;
  stock_kinds: number;
  month_income: number;
  month_expense: number;
  month_profit: number;
  pending_tasks: number;
  pending_groups: {plot_id: string; plot_name: string; crop_name: string; stage_name: string; pending: number}[];
}

interface StockLine {
  fertilizer_id: string;
  fertilizer_name: string;
  in_kg: number;
  out_kg: number;
  stock_kg: number;
  avg_price: number;
  stock_value: number;
}

interface Entry {
  id: string;
  kind: string;
  description: string;
  amount: number;
  occurred_at: number;
  checked: boolean;
  note: string | null;
}

interface Financials {
  period: string;
  total_income: number;
  total_expense: number;
  profit: number;
  incomes: Entry[];
  expenses: Entry[];
}

interface PlanRow {
  id: string;
  crop_name: string | null;
  crop_type: string;
  variety_name: string | null;
  scenario_name: string;
  area_input: number;
  area_unit: string;
  cost_min: number | null;
  cost_max: number | null;
  note: string | null;
  created_at: number;
}

interface WarehouseInRow {
  id: string;
  fertilizer_id: string;
  fertilizer_name: string;
  category: string | null;
  quantity: number;
  unit: string;
  quantity_kg: number;
  price: number;
  unit_price: number;
  occurred_at: number;
  note: string | null;
}

interface WarehouseOutRow {
  id: string;
  fertilizer_id: string;
  fertilizer_name: string;
  category: string | null;
  quantity_kg: number;
  unit_price: number;
  total_cost: number;
  occurred_at: number;
  note: string | null;
}

type EditTarget =
  | {type: "income"; row: Entry}
  | {type: "expense"; row: Entry}
  | {type: "warehouseIn"; row: WarehouseInRow}
  | {type: "warehouseOut"; row: WarehouseOutRow}
  | {type: "plan"; row: PlanRow};

const INCOME_KINDS: readonly {code: string; label: string}[] = [
  {code: "product", label: "Sản phẩm"},
  {code: "service", label: "Dịch vụ"},
  {code: "other", label: "Khác"},
];

const EXPENSE_KINDS: readonly {code: string; label: string}[] = [
  {code: "seed", label: "Giống"},
  {code: "fertilizer", label: "Phân bón"},
  {code: "labor", label: "Công nhân"},
  {code: "utilities", label: "Điện nước"},
  {code: "other", label: "Khác"},
];

const kindLabel = (side: "income" | "expense", code: string) =>
  (side === "income" ? INCOME_KINDS : EXPENSE_KINDS).find(k => k.code === code)?.label ?? code;

const pathFor = (t: EditTarget) =>
  t.type === "income"
    ? `/income/${t.row.id}`
    : t.type === "expense"
      ? `/expense/${t.row.id}`
      : t.type === "warehouseIn"
        ? `/warehouse/in/${t.row.id}`
        : t.type === "warehouseOut"
          ? `/warehouse/out/${t.row.id}`
          : `/plans/${t.row.id}`;

const labelFor = (t: EditTarget) =>
  t.type === "income"
    ? `khoản thu "${t.row.description}"`
    : t.type === "expense"
      ? `khoản chi "${t.row.description}"`
      : t.type === "warehouseIn"
        ? `phiếu nhập "${t.row.fertilizer_name}"`
        : t.type === "warehouseOut"
          ? `phiếu xuất "${t.row.fertilizer_name}"`
          : `kế hoạch "${t.row.scenario_name}"`;

const now = new Date();
/** Joins non-empty query parts into "?a=1&b=2" (or "" when there are none). */
const qs = (...parts: string[]) => {
  const kept = parts.filter(Boolean);
  return kept.length ? `?${kept.join("&")}` : "";
};
const dayLabel = (ms: number) => new Date(ms).toLocaleDateString("vi-VN", {day: "2-digit", month: "2-digit", timeZone: "Asia/Ho_Chi_Minh"});
/** yyyy-mm-dd in Vietnam time, for an <input type="date"> value. */
const dateInputValue = (ms: number) => new Date(ms).toLocaleDateString("sv-SE", {timeZone: "Asia/Ho_Chi_Minh"});
/** The reverse conversion — noon Vietnam time avoids any UTC day-shift. */
const msFromDateInput = (value: string) => new Date(`${value}T12:00:00+07:00`).getTime();

export function FarmView({ownerId}: {ownerId: string}) {
  const {me, isAdmin} = useAdmin();
  const [periodKind, setPeriodKind] = useState<"month" | "quarter">("month");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [quarter, setQuarter] = useState(Math.floor(now.getMonth() / 3) + 1);
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [stock, setStock] = useState<StockLine[] | null>(null);
  const [fin, setFin] = useState<Financials | null>(null);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [warehouseIn, setWarehouseIn] = useState<WarehouseInRow[]>([]);
  const [warehouseOut, setWarehouseOut] = useState<WarehouseOutRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionNote, setActionNote] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfNote, setPdfNote] = useState<string | null>(null);
  const {confirm, dialog} = useConfirm();

  const ownerQuery = ownerId !== me.id ? `owner_id=${ownerId}` : "";
  const periodQuery = periodKind === "month" ? `year=${year}&month=${month}` : `year=${year}&quarter=${quarter}`;

  // Figures for the chosen farm and period, plus — for an admin — the raw
  // rows behind them so Sửa/Xoá has something to act on.
  const reload = useCallback(async () => {
    // The dashboard card is always "this month"; a quarter picks its last month.
    const cardMonth = periodKind === "month" ? month : quarter * 3;
    try {
      const [d, s, f] = await Promise.all([
        api<Dashboard>(`/dashboard/summary${qs(`year=${year}`, `month=${cardMonth}`, ownerQuery)}`),
        api<{lines: StockLine[]}>(`/warehouse/summary${qs(ownerQuery)}`),
        api<Financials>(`/reports/financials${qs(periodQuery, ownerQuery)}`),
      ]);
      setError(null);
      setDash(d);
      setStock(s.lines);
      setFin(f);
      if (isAdmin) {
        const [p, wi, wo] = await Promise.all([
          api<PlanRow[]>(`/plans${qs(ownerQuery)}`),
          api<WarehouseInRow[]>(`/warehouse/in${qs(ownerQuery)}`),
          api<WarehouseOutRow[]>(`/warehouse/out${qs(ownerQuery)}`),
        ]);
        setPlans(p);
        setWarehouseIn(wi);
        setWarehouseOut(wo);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [isAdmin, ownerQuery, periodQuery, year, month, quarter, periodKind]);

  // Tháng hiện tại chưa có phát sinh thì mở sẵn tháng gần nhất có dữ liệu của năm nay,
  // để người xem không phải mở hộp chọn kỳ mới thấy số liệu.
  useEffect(() => {
    let cancelled = false;
    api<Financials>(`/reports/financials${qs(`year=${now.getFullYear()}`, ownerQuery)}`)
      .then(r => {
        if (cancelled) return;
        const months = [...r.incomes, ...r.expenses].map(e => Number(dateInputValue(e.occurred_at).slice(5, 7)));
        if (months.length > 0 && !months.includes(now.getMonth() + 1)) setMonth(Math.max(...months));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [ownerQuery]);

  useEffect(() => {
    // `reload` chỉ setState sau khi các yêu cầu mạng trả về, không đồng bộ trong thân effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  const exportPdf = useCallback(async () => {
    if (pdfBusy) return;
    setPdfBusy(true);
    setPdfNote(null);
    try {
      const {blob, filename} = await apiBlob(`/reports/financials.pdf${qs(periodQuery, ownerQuery)}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setPdfNote(`Đã tải ${filename}`);
    } catch (e) {
      setPdfNote(e instanceof ApiError ? e.message : "Không xuất được PDF");
    } finally {
      setPdfBusy(false);
    }
  }, [pdfBusy, periodQuery, ownerQuery]);

  const removeRow = async (target: EditTarget) => {
    const ok = await confirm({
      title: "Xoá bản ghi",
      message: `Xoá ${labelFor(target)}? Thao tác này không thể hoàn tác và sẽ đồng bộ xuống điện thoại của nông hộ.`,
      confirmLabel: "Xoá",
      danger: true,
    });
    if (!ok) return;
    setBusyId(target.row.id);
    setActionNote(null);
    setError(null);
    try {
      await api<void>(pathFor(target), {method: "DELETE"});
      setActionNote(`Đã xoá ${labelFor(target)}`);
      await reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Không xoá được bản ghi");
    } finally {
      setBusyId(null);
    }
  };

  const ledgerRows = useMemo(
    () =>
      fin
        ? [
            ...fin.incomes.map(e => ({...e, side: "Thu" as const, kindOf: "income" as const})),
            ...fin.expenses.map(e => ({...e, side: "Chi" as const, kindOf: "expense" as const})),
          ].sort((a, b) => a.occurred_at - b.occurred_at)
        : [],
    [fin],
  );
  const warehouseRows = useMemo(
    () =>
      [
        ...warehouseIn.map(r => ({...r, side: "Nhập" as const})),
        ...warehouseOut.map(r => ({...r, side: "Xuất" as const})),
      ].sort((a, b) => b.occurred_at - a.occurred_at),
    [warehouseIn, warehouseOut],
  );
  const ledgerPage = usePaged(ledgerRows, 8);
  const warehousePage = usePaged(warehouseRows, 8);
  const planPage = usePaged(plans, 6);

  const loss = (dash?.month_profit ?? 0) < 0;
  const pendingText =
    dash && dash.pending_groups.length > 0
      ? dash.pending_groups
          .slice(0, 3)
          .map(g => `${g.crop_name} · ${g.stage_name.split(" (")[0]}: ${g.pending}`)
          .join("; ")
      : "Không có việc nào chờ ở giai đoạn hiện tại";

  return (
    <div className="stack">
      {error ? <Notice>{error}</Notice> : null}
      {actionNote ? <Notice tone="green">{actionNote}</Notice> : null}

      <section className="grid grid-kpi grid-kpi-3" aria-label="Tóm tắt">
        <Kpi
          label="Tồn kho"
          icon="warehouse"
          value={dash ? formatVnd(Math.round(dash.stock_value)) : "—"}
          hint={dash && dash.stock_kinds > 0 ? `${dash.stock_kinds} loại phân bón, ${formatKg(dash.stock_kg)}` : "Kho trống"}
        />
        <Kpi
          label={`Tháng ${dash?.month ?? month}`}
          icon="wallet"
          tone={loss ? "red" : "green"}
          negative={loss}
          value={dash ? `${loss ? "Lỗ" : "Lãi"} ${formatVnd(Math.abs(Math.round(dash.month_profit)))}` : "—"}
          hint={`Thu ${formatVnd(dash?.month_income ?? 0)} · Chi ${formatVnd(dash?.month_expense ?? 0)}`}
        />
        <Kpi
          label="Công việc"
          icon="sprout"
          tone="amber"
          value={dash ? `${dash.pending_tasks} việc` : "—"}
          hint={pendingText}
        />
      </section>

      <Panel
        id="finance"
        title="Báo cáo thu – chi"
        subtitle={fin?.period}
        actions={
          <>
            <select className="compact" value={periodKind} onChange={e => setPeriodKind(e.target.value as "month" | "quarter")} aria-label="Loại kỳ">
              <option value="month">Tháng</option>
              <option value="quarter">Quý</option>
            </select>
            {periodKind === "month" ? (
              <select className="compact" value={month} onChange={e => setMonth(Number(e.target.value))} aria-label="Tháng">
                {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>
                    Tháng {m}
                  </option>
                ))}
              </select>
            ) : (
              <select className="compact" value={quarter} onChange={e => setQuarter(Number(e.target.value))} aria-label="Quý">
                {[1, 2, 3, 4].map(q => (
                  <option key={q} value={q}>
                    Quý {q}
                  </option>
                ))}
              </select>
            )}
            <select className="compact" value={year} onChange={e => setYear(Number(e.target.value))} aria-label="Năm">
              {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <button className="btn btn-primary" type="button" onClick={exportPdf} disabled={pdfBusy || !fin || ledgerRows.length === 0}>
              <Icon name="download" size={16} />
              {pdfBusy ? "Đang tạo PDF…" : "Xuất PDF"}
            </button>
          </>
        }
        flush
      >
        {!fin ? (
          <TableSkeleton rows={5} cols={4} />
        ) : (
          <>
            <dl className="totals-strip">
              <div>
                <dt>Thu</dt>
                <dd>{formatVnd(fin.total_income)}</dd>
              </div>
              <div>
                <dt>Chi</dt>
                <dd>{formatVnd(fin.total_expense)}</dd>
              </div>
              <div>
                <dt>Lãi/Lỗ</dt>
                <dd className={fin.profit < 0 ? "neg" : "pos"}>{formatVnd(fin.profit)}</dd>
              </div>
            </dl>
            {pdfNote ? (
              <p className="muted small" style={{padding: "0 20px 12px"}}>
                {pdfNote}
              </p>
            ) : null}
            {ledgerRows.length === 0 ? (
              <EmptyState icon="wallet" title="Chưa có khoản thu – chi nào" hint="Chọn kỳ khác, hoặc để nông hộ ghi sổ trên điện thoại rồi đồng bộ." />
            ) : (
              <>
                <div className="data-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Ngày</th>
                        <th>Loại</th>
                        <th>Mô tả</th>
                        <th className="num">Số tiền</th>
                        {isAdmin ? <th aria-label="Thao tác" /> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {ledgerPage.slice.map(e => (
                        <tr key={`${e.side}-${e.id}`}>
                          <td className="nowrap">{dayLabel(e.occurred_at)}</td>
                          <td>
                            <Pill tone={e.side === "Thu" ? "green" : "gray"}>{e.side}</Pill>
                          </td>
                          <td>
                            <span className="cell-main">{e.description}</span>
                            <span className="cell-sub">
                              {kindLabel(e.kindOf, e.kind)}
                              {e.checked ? " · đã đối chiếu" : ""}
                              {e.note ? ` · ${e.note}` : ""}
                            </span>
                          </td>
                          <td className={e.side === "Thu" ? "num pos" : "num"}>
                            {e.side === "Thu" ? "+" : "−"}
                            {formatVnd(e.amount)}
                          </td>
                          {isAdmin ? (
                            <td>
                              <RowActions busy={busyId === e.id} onEdit={() => setEditing({type: e.kindOf, row: e})} onDelete={() => removeRow({type: e.kindOf, row: e})} />
                            </td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pager {...ledgerPage} onPage={ledgerPage.setPage} noun="khoản" />
              </>
            )}
          </>
        )}
      </Panel>

      <Panel id="stock" title="Bảng tồn kho" subtitle="Giá bình quân theo phương pháp nhập trước – xuất trước (FIFO)" flush>
        {stock === null ? (
          <TableSkeleton rows={3} cols={6} />
        ) : stock.length === 0 ? (
          <EmptyState icon="warehouse" title="Chưa có phiếu nhập nào" hint="Kho sẽ hiện ở đây sau khi nông hộ nhập phân bón." />
        ) : (
          <div className="data-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Phân bón</th>
                  <th className="num">Nhập (kg)</th>
                  <th className="num">Xuất (kg)</th>
                  <th className="num">Tồn (kg)</th>
                  <th className="num">Giá TB</th>
                  <th className="num">Giá trị tồn</th>
                </tr>
              </thead>
              <tbody>
                {stock.map(l => (
                  <tr key={l.fertilizer_id}>
                    <td>
                      <span className="cell-main">{l.fertilizer_name}</span>
                    </td>
                    <td className="num">{l.in_kg}</td>
                    <td className="num">{l.out_kg}</td>
                    <td className="num">
                      <strong>{l.stock_kg}</strong>
                    </td>
                    <td className="num">{formatVnd(Math.round(l.avg_price))}</td>
                    <td className="num">{formatVnd(Math.round(l.stock_value))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {isAdmin ? (
        <>
          <Panel id="warehouse-rows" title="Phiếu nhập – xuất kho" flush>
            {warehouseRows.length === 0 ? (
              <EmptyState icon="warehouse" title="Chưa có phiếu nhập/xuất nào" />
            ) : (
              <>
                <div className="data-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Ngày</th>
                        <th>Loại</th>
                        <th>Phân bón</th>
                        <th className="num">Số lượng (kg)</th>
                        <th className="num">Đơn giá</th>
                        <th aria-label="Thao tác" />
                      </tr>
                    </thead>
                    <tbody>
                      {warehousePage.slice.map(r => {
                        const target: EditTarget =
                          r.side === "Nhập" ? {type: "warehouseIn", row: r as WarehouseInRow} : {type: "warehouseOut", row: r as WarehouseOutRow};
                        return (
                          <tr key={`${r.side}-${r.id}`}>
                            <td className="nowrap">{dayLabel(r.occurred_at)}</td>
                            <td>
                              <Pill tone={r.side === "Nhập" ? "green" : "gray"}>{r.side}</Pill>
                            </td>
                            <td>
                              <span className="cell-main">{r.fertilizer_name}</span>
                              {r.note ? <span className="cell-sub">{r.note}</span> : null}
                            </td>
                            <td className="num">{r.quantity_kg}</td>
                            <td className="num">{formatVnd(Math.round(r.unit_price))}</td>
                            <td>
                              <RowActions busy={busyId === r.id} onEdit={() => setEditing(target)} onDelete={() => removeRow(target)} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <Pager {...warehousePage} onPage={warehousePage.setPage} noun="phiếu" />
              </>
            )}
          </Panel>

          <Panel id="plans" title="Kế hoạch bón phân" subtitle="Kết quả tính lượng phân đã lưu từ ứng dụng" flush>
            {plans.length === 0 ? (
              <EmptyState icon="sprout" title="Chưa có kế hoạch nào" />
            ) : (
              <>
                <div className="data-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Ngày tạo</th>
                        <th>Cây / giống</th>
                        <th>Phương án</th>
                        <th className="num">Diện tích</th>
                        <th className="num">Chi phí</th>
                        <th aria-label="Thao tác" />
                      </tr>
                    </thead>
                    <tbody>
                      {planPage.slice.map(p => (
                        <tr key={p.id}>
                          <td className="nowrap">{dayLabel(p.created_at)}</td>
                          <td>
                            <span className="cell-main">{p.crop_name ?? p.crop_type}</span>
                            {p.variety_name ? <span className="cell-sub">{p.variety_name}</span> : null}
                          </td>
                          <td>{p.scenario_name}</td>
                          <td className="num">
                            {p.area_input} {p.area_unit}
                          </td>
                          <td className="num">
                            {p.cost_min != null && p.cost_max != null ? `${formatVnd(p.cost_min)} – ${formatVnd(p.cost_max)}` : "—"}
                          </td>
                          <td>
                            <RowActions
                              busy={busyId === p.id}
                              onEdit={() => setEditing({type: "plan", row: p})}
                              onDelete={() => removeRow({type: "plan", row: p})}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pager {...planPage} onPage={planPage.setPage} noun="kế hoạch" />
              </>
            )}
          </Panel>
        </>
      ) : null}

      {editing ? (
        <EditModal
          target={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            setActionNote("Đã lưu thay đổi");
            await reload();
          }}
        />
      ) : null}
      {dialog}
    </div>
  );
}

function RowActions({busy, onEdit, onDelete}: {busy: boolean; onEdit: () => void; onDelete: () => void}) {
  return (
    <div className="cell-actions">
      <button type="button" className="icon-btn" onClick={onEdit} disabled={busy} aria-label="Sửa" title="Sửa">
        <Icon name="edit" size={16} />
      </button>
      <button type="button" className="icon-btn icon-btn-danger" onClick={onDelete} disabled={busy} aria-label="Xoá" title="Xoá">
        <Icon name="trash" size={16} />
      </button>
    </div>
  );
}

function EditModal({target, onClose, onSaved}: {target: EditTarget; onClose: () => void; onSaved: () => Promise<void>}) {
  const isLedger = target.type === "income" || target.type === "expense";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [description, setDescription] = useState(isLedger ? target.row.description : "");
  const [amount, setAmount] = useState(isLedger ? String(target.row.amount) : "");
  const [kind, setKind] = useState(isLedger ? target.row.kind : "");
  const [checked, setChecked] = useState(isLedger ? target.row.checked : false);

  const isWarehouse = target.type === "warehouseIn" || target.type === "warehouseOut";
  const [occurredAt, setOccurredAt] = useState(isLedger || isWarehouse ? dateInputValue(target.row.occurred_at) : "");
  const [note, setNote] = useState(target.row.note ?? "");

  const [fertilizerName, setFertilizerName] = useState(isWarehouse ? target.row.fertilizer_name : "");
  const [quantity, setQuantity] = useState(target.type === "warehouseIn" ? String(target.row.quantity) : "");
  const [unit, setUnit] = useState(target.type === "warehouseIn" ? target.row.unit : "kg");
  const [price, setPrice] = useState(target.type === "warehouseIn" ? String(target.row.price) : "");
  const [quantityKg, setQuantityKg] = useState(target.type === "warehouseOut" ? String(target.row.quantity_kg) : "");
  const [unitPrice, setUnitPrice] = useState(target.type === "warehouseOut" ? String(target.row.unit_price) : "");

  const [scenarioName, setScenarioName] = useState(target.type === "plan" ? target.row.scenario_name : "");
  const [costMin, setCostMin] = useState(target.type === "plan" ? (target.row.cost_min?.toString() ?? "") : "");
  const [costMax, setCostMax] = useState(target.type === "plan" ? (target.row.cost_max?.toString() ?? "") : "");

  const title =
    target.type === "income"
      ? "Sửa khoản thu"
      : target.type === "expense"
        ? "Sửa khoản chi"
        : target.type === "warehouseIn"
          ? "Sửa phiếu nhập kho"
          : target.type === "warehouseOut"
            ? "Sửa phiếu xuất kho"
            : "Sửa kế hoạch";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      let body: Record<string, unknown>;
      if (target.type === "income" || target.type === "expense") {
        body = {kind, description, amount: Number(amount), occurred_at: msFromDateInput(occurredAt), note: note || null, checked};
      } else if (target.type === "warehouseIn") {
        body = {fertilizer_name: fertilizerName, quantity: Number(quantity), unit, price: Number(price), occurred_at: msFromDateInput(occurredAt), note: note || null};
      } else if (target.type === "warehouseOut") {
        body = {fertilizer_name: fertilizerName, quantity_kg: Number(quantityKg), unit_price: Number(unitPrice), occurred_at: msFromDateInput(occurredAt), note: note || null};
      } else {
        body = {
          scenario_name: scenarioName,
          cost_min: costMin === "" ? null : Number(costMin),
          cost_max: costMax === "" ? null : Number(costMax),
          note: note || null,
        };
      }
      await api(pathFor(target), {method: "PATCH", body: JSON.stringify(body)});
      await onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Không lưu được thay đổi");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" type="button" onClick={onClose}>
            Huỷ
          </button>
          <button className="btn btn-primary" type="submit" form="edit-form" disabled={busy}>
            {busy ? "Đang lưu…" : "Lưu thay đổi"}
          </button>
        </>
      }
    >
      <form id="edit-form" onSubmit={submit}>
        {target.type === "income" || target.type === "expense" ? (
          <>
            <Field label="Loại" htmlFor="edit-kind">
              <select id="edit-kind" value={kind} onChange={e => setKind(e.target.value)}>
                {(target.type === "income" ? INCOME_KINDS : EXPENSE_KINDS).map(k => (
                  <option key={k.code} value={k.code}>
                    {k.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Mô tả" htmlFor="edit-description">
              <input id="edit-description" value={description} onChange={e => setDescription(e.target.value)} required />
            </Field>
            <div className="form-grid-2">
              <Field label="Số tiền (đồng)" htmlFor="edit-amount">
                <input id="edit-amount" type="number" min={0} value={amount} onChange={e => setAmount(e.target.value)} required />
              </Field>
              <Field label="Ngày" htmlFor="edit-date">
                <input id="edit-date" type="date" value={occurredAt} onChange={e => setOccurredAt(e.target.value)} required />
              </Field>
            </div>
            <label className="check-row">
              <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} />
              Đã đối chiếu
            </label>
          </>
        ) : null}

        {target.type === "warehouseIn" ? (
          <>
            <Field label="Phân bón" htmlFor="edit-fertilizer">
              <input id="edit-fertilizer" value={fertilizerName} onChange={e => setFertilizerName(e.target.value)} required />
            </Field>
            <div className="form-grid-2">
              <Field label="Số lượng" htmlFor="edit-quantity">
                <input id="edit-quantity" type="number" min={0} step="any" value={quantity} onChange={e => setQuantity(e.target.value)} required />
              </Field>
              <Field label="Đơn vị" htmlFor="edit-unit">
                <select id="edit-unit" value={unit} onChange={e => setUnit(e.target.value)}>
                  <option value="kg">kg</option>
                  <option value="tan">tấn</option>
                </select>
              </Field>
            </div>
            <div className="form-grid-2">
              <Field label="Tổng tiền (đồng)" htmlFor="edit-price">
                <input id="edit-price" type="number" min={0} value={price} onChange={e => setPrice(e.target.value)} required />
              </Field>
              <Field label="Ngày" htmlFor="edit-date">
                <input id="edit-date" type="date" value={occurredAt} onChange={e => setOccurredAt(e.target.value)} required />
              </Field>
            </div>
          </>
        ) : null}

        {target.type === "warehouseOut" ? (
          <>
            <Field label="Phân bón" htmlFor="edit-fertilizer">
              <input id="edit-fertilizer" value={fertilizerName} onChange={e => setFertilizerName(e.target.value)} required />
            </Field>
            <div className="form-grid-2">
              <Field label="Số lượng (kg)" htmlFor="edit-quantity-kg">
                <input id="edit-quantity-kg" type="number" min={0} step="any" value={quantityKg} onChange={e => setQuantityKg(e.target.value)} required />
              </Field>
              <Field label="Đơn giá (đồng/kg)" htmlFor="edit-unit-price">
                <input id="edit-unit-price" type="number" min={0} value={unitPrice} onChange={e => setUnitPrice(e.target.value)} required />
              </Field>
            </div>
            <Field label="Ngày" htmlFor="edit-date">
              <input id="edit-date" type="date" value={occurredAt} onChange={e => setOccurredAt(e.target.value)} required />
            </Field>
          </>
        ) : null}

        {target.type === "plan" ? (
          <>
            <Field label="Phương án" htmlFor="edit-scenario">
              <input id="edit-scenario" value={scenarioName} onChange={e => setScenarioName(e.target.value)} required />
            </Field>
            <div className="form-grid-2">
              <Field label="Chi phí thấp nhất" htmlFor="edit-cost-min">
                <input id="edit-cost-min" type="number" min={0} value={costMin} onChange={e => setCostMin(e.target.value)} />
              </Field>
              <Field label="Chi phí cao nhất" htmlFor="edit-cost-max">
                <input id="edit-cost-max" type="number" min={0} value={costMax} onChange={e => setCostMax(e.target.value)} />
              </Field>
            </div>
          </>
        ) : null}

        <Field label="Ghi chú" htmlFor="edit-note">
          <input id="edit-note" value={note} onChange={e => setNote(e.target.value)} />
        </Field>

        {error ? (
          <div style={{marginTop: 16}}>
            <Notice>{error}</Notice>
          </div>
        ) : null}
      </form>
    </Modal>
  );
}
