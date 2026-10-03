"use client";

/**
 * Sổ sách nông hộ — one farm's books as the phone keeps them: tồn kho phân
 * bón, thu – chi of a month or quarter (with the PDF export), the tasks that
 * wait in the current stage, phiếu nhập – xuất kho and kế hoạch vụ mùa.
 *
 * Admin picks the farm (the overview links here with ?owner=<id>) and gets
 * Sửa / Xoá on every row — for fixing a farmer's typo or a duplicate entry
 * instead of asking them to redo it on the phone. A farmer signed into the web
 * sees their own books, read-only.
 */

import Link from "next/link";
import {useRouter, useSearchParams} from "next/navigation";
import {FormEvent, Suspense, useEffect, useMemo, useState} from "react";

import {useAdmin} from "@/components/AdminShell";
import {IconCoins, IconDownload, IconEdit, IconFarms, IconTasks, IconTrash, IconWarehouse} from "@/components/icons";
import {EmptyState, Modal, PageHeader, Panel, Pill, Segmented, Skeleton, StatCard, Toast} from "@/components/ui";
import {api, apiBlob, ApiError, formatKg, formatVnd} from "@/lib/api";

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

type PeriodKind = "month" | "quarter";

/** One farm's books for one period, tagged with the farm they belong to. */
interface Books {
  owner: string;
  dash: Dashboard;
  stock: StockLine[];
  fin: Financials;
  plans: PlanRow[];
  warehouseIn: WarehouseInRow[];
  warehouseOut: WarehouseOutRow[];
}

const INCOME_KINDS: readonly {code: string; label: string}[] = [
  {code: "product", label: "Sản phẩm"},
  {code: "service", label: "Dịch vụ"},
  {code: "other", label: "Khác"},
];

const EXPENSE_KINDS: readonly {code: string; label: string}[] = [
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
/** Plans keep the calculator's unit code — show the unit, not the code.
 * Same table as mobile/src/domain/areaUnits.ts; the last four are no longer
 * offered but plans saved with them still read back. */
const AREA_UNIT_SHORT: Record<string, string> = {
  m2: "m²",
  sao_lam_dong: "sào",
  ha: "ha",
  sao_bac: "sào BB",
  sao_trung: "sào TB",
  cong_nam: "công",
  mau_bac: "mẫu BB",
};
const dayLabel = (ms: number) => new Date(ms).toLocaleDateString("vi-VN", {day: "2-digit", month: "2-digit", year: "numeric"});
/** yyyy-mm-dd in Vietnam time, for an <input type="date"> value. */
const dateInputValue = (ms: number) => new Date(ms).toLocaleDateString("sv-SE", {timeZone: "Asia/Ho_Chi_Minh"});
/** The reverse conversion — noon Vietnam time avoids any UTC day-shift. */
const msFromDateInput = (value: string) => new Date(`${value}T12:00:00+07:00`).getTime();
const kg = (value: number) => new Intl.NumberFormat("vi-VN", {maximumFractionDigits: 2}).format(value);

/** Figures for a farm and period, plus — for an admin — the raw rows behind
 * them so Sửa/Xoá has something to act on. The cards are always one month;
 * a quarter shows its last month there. */
async function fetchBooks(owner: string, ownerQuery: string, periodQuery: string, year: number, cardMonth: number, withRows: boolean): Promise<Books> {
  const [dash, stock, fin] = await Promise.all([
    api<Dashboard>(`/dashboard/summary${qs(`year=${year}`, `month=${cardMonth}`, ownerQuery)}`),
    api<{lines: StockLine[]}>(`/warehouse/summary${qs(ownerQuery)}`),
    api<Financials>(`/reports/financials${qs(periodQuery, ownerQuery)}`),
  ]);
  const [plans, warehouseIn, warehouseOut] = withRows
    ? await Promise.all([
        api<PlanRow[]>(`/plans${qs(ownerQuery)}`),
        api<WarehouseInRow[]>(`/warehouse/in${qs(ownerQuery)}`),
        api<WarehouseOutRow[]>(`/warehouse/out${qs(ownerQuery)}`),
      ])
    : [[], [], []];
  return {owner, dash, stock: stock.lines, fin, plans, warehouseIn, warehouseOut};
}

export default function FarmBooksPage() {
  // useSearchParams needs a Suspense boundary for the static build.
  return (
    <Suspense fallback={<main className="page" aria-busy="true" />}>
      <FarmBooks />
    </Suspense>
  );
}

function FarmBooks() {
  const router = useRouter();
  const params = useSearchParams();
  const {me, isAdmin, farms} = useAdmin();

  // An admin reads any farm (?owner=, else the first one); a farmer only their own.
  const requested = params.get("owner");
  const ownerId = isAdmin ? (farms.find(f => f.id === requested)?.id ?? farms[0]?.id ?? null) : me.id;
  const ownerQuery = isAdmin && ownerId ? `owner_id=${ownerId}` : "";

  const [periodKind, setPeriodKind] = useState<PeriodKind>("month");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [quarter, setQuarter] = useState(Math.floor(now.getMonth() / 3) + 1);
  const [books, setBooks] = useState<Books | null>(null);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{message: string; tone?: "green" | "red"} | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  const periodQuery = periodKind === "month" ? `year=${year}&month=${month}` : `year=${year}&quarter=${quarter}`;
  const periodName = periodKind === "month" ? `tháng ${month}/${year}` : `quý ${quarter}/${year}`;

  const cardMonth = periodKind === "month" ? month : quarter * 3;

  useEffect(() => {
    if (!ownerId) return;
    let alive = true;
    fetchBooks(ownerId, ownerQuery, periodQuery, year, cardMonth, isAdmin)
      .then(b => {
        if (!alive) return;
        setBooks(b);
        setError(null);
      })
      .catch(e => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [ownerId, ownerQuery, periodQuery, year, cardMonth, isAdmin, version]);

  const reload = () => setVersion(v => v + 1);
  // A different farm starts from blank cards rather than the previous farm's.
  const current = books?.owner === ownerId ? books : null;
  const dash = current?.dash ?? null;
  const stock = current?.stock ?? null;
  const fin = current?.fin ?? null;
  const plans = useMemo(() => current?.plans ?? [], [current]);
  const warehouseIn = useMemo(() => current?.warehouseIn ?? [], [current]);
  const warehouseOut = useMemo(() => current?.warehouseOut ?? [], [current]);

  const pickFarm = (id: string) => router.replace(`/farms?owner=${encodeURIComponent(id)}`);

  const exportPdf = async () => {
    if (pdfBusy) return;
    setPdfBusy(true);
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
      setToast({message: `Đã tải ${filename}`});
    } catch (e) {
      setToast({message: e instanceof ApiError ? e.message : "Không xuất được PDF", tone: "red"});
    } finally {
      setPdfBusy(false);
    }
  };

  const removeRow = async (target: EditTarget) => {
    if (!window.confirm(`Xoá ${labelFor(target)}? Không thể hoàn tác.`)) return;
    setBusyId(target.row.id);
    try {
      await api<void>(pathFor(target), {method: "DELETE"});
      setToast({message: `Đã xoá ${labelFor(target)}`});
      reload();
    } catch (e) {
      setToast({message: e instanceof ApiError ? e.message : "Không xoá được bản ghi", tone: "red"});
    } finally {
      setBusyId(null);
    }
  };

  const ledger = useMemo(
    () =>
      fin
        ? [
            ...fin.incomes.map(e => ({...e, side: "income" as const})),
            ...fin.expenses.map(e => ({...e, side: "expense" as const})),
          ].sort((a, b) => b.occurred_at - a.occurred_at)
        : [],
    [fin],
  );

  const warehouseRows = useMemo(
    () =>
      [
        ...warehouseIn.map(r => ({side: "in" as const, row: r, total: r.price})),
        ...warehouseOut.map(r => ({side: "out" as const, row: r, total: r.total_cost})),
      ].sort((a, b) => b.row.occurred_at - a.row.occurred_at),
    [warehouseIn, warehouseOut],
  );

  if (isAdmin && farms.length === 0) {
    return (
      <main className="page">
        <PageHeader title="Sổ sách nông hộ" subtitle="Thu – chi, kho phân bón và kế hoạch của từng nông hộ." />
        <Panel>
          <EmptyState
            icon={<IconFarms />}
            title="Chưa có nông hộ nào"
            body="Tạo tài khoản cho nông hộ, họ đăng nhập trên điện thoại và đồng bộ — sổ sách sẽ hiện ở đây."
            action={
              <Link className="btn btn-primary" href="/accounts">
                Tạo tài khoản
              </Link>
            }
          />
        </Panel>
      </main>
    );
  }

  const farm = farms.find(f => f.id === ownerId);
  const name = dash?.full_name ?? farm?.full_name ?? me.full_name;
  const region = dash?.region ?? farm?.region ?? null;
  const loss = (dash?.month_profit ?? 0) < 0;
  const hasLedger = ledger.length > 0;
  const placeholder = <Skeleton height={28} width={120} />;

  return (
    <main className="page">
      <PageHeader
        title={isAdmin ? name : "Trang trại của tôi"}
        subtitle={
          <>
            {isAdmin ? "Sổ sách nông hộ" : name}
            {region ? ` · ${region}` : ""} · số liệu đồng bộ từ điện thoại{isAdmin ? "" : ", chỉ xem"}
          </>
        }
        actions={
          <>
            {isAdmin ? (
              <select className="input" value={ownerId ?? ""} onChange={e => pickFarm(e.target.value)} aria-label="Chọn nông hộ" style={{minWidth: 240}}>
                {farms.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.full_name || f.username} ({f.username})
                  </option>
                ))}
              </select>
            ) : null}
            <button className="btn btn-primary" type="button" onClick={exportPdf} disabled={pdfBusy || !hasLedger} title={hasLedger ? undefined : `Không có thu – chi trong ${periodName}`}>
              <IconDownload size={18} /> {pdfBusy ? "Đang tạo PDF…" : `Xuất PDF ${periodName}`}
            </button>
          </>
        }
      />
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid grid-kpi">
        <StatCard
          label="Tồn kho phân bón"
          tone="green"
          icon={<IconWarehouse size={22} />}
          value={dash ? formatVnd(Math.round(dash.stock_value)) : placeholder}
          sub={dash ? (dash.stock_kinds > 0 ? `${dash.stock_kinds} loại · ${formatKg(dash.stock_kg)}` : "Kho trống") : null}
        />
        <StatCard
          label={`Thu tháng ${cardMonth}`}
          tone="blue"
          icon={<IconCoins size={22} />}
          value={dash ? formatVnd(dash.month_income) : placeholder}
          sub={dash ? `Chi ${formatVnd(dash.month_expense)}` : null}
        />
        <StatCard
          label={`${loss ? "Lỗ" : "Lãi"} tháng ${cardMonth}`}
          tone={loss ? "coral" : "lime"}
          icon={<IconCoins size={22} />}
          value={dash ? <span className={loss ? "down" : undefined}>{formatVnd(Math.abs(Math.round(dash.month_profit)))}</span> : placeholder}
          sub="Thu trừ chi trong tháng"
        />
        <StatCard
          label="Việc chờ ở giai đoạn này"
          tone="amber"
          icon={<IconTasks size={22} />}
          value={dash ? dash.pending_tasks : placeholder}
          sub={dash ? (dash.pending_groups.length > 0 ? `Trên ${dash.pending_groups.length} lô đang trồng` : "Không có việc nào chờ") : null}
        />
      </div>

      <div className="grid grid-main">
        <Panel
          title="Thu – chi"
          subtitle={`Các khoản trong ${periodName}, mới nhất trước.`}
          action={
            <div className="toolbar">
              <Segmented<PeriodKind>
                label="Loại kỳ"
                value={periodKind}
                onChange={setPeriodKind}
                options={[
                  {value: "month", label: "Tháng"},
                  {value: "quarter", label: "Quý"},
                ]}
              />
              {periodKind === "month" ? (
                <select className="input" value={month} onChange={e => setMonth(Number(e.target.value))} aria-label="Tháng" style={{minWidth: 120}}>
                  {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                    <option key={m} value={m}>
                      Tháng {m}
                    </option>
                  ))}
                </select>
              ) : (
                <select className="input" value={quarter} onChange={e => setQuarter(Number(e.target.value))} aria-label="Quý" style={{minWidth: 110}}>
                  {[1, 2, 3, 4].map(q => (
                    <option key={q} value={q}>
                      Quý {q}
                    </option>
                  ))}
                </select>
              )}
              <select className="input" value={year} onChange={e => setYear(Number(e.target.value))} aria-label="Năm" style={{minWidth: 100}}>
                {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          }
          flush>
          <div className="ledger-totals">
            <div>
              <span className="ledger-totals-label">
                <i className="dot" style={{background: "#2E6F40"}} /> Thu
              </span>
              <strong>{fin ? formatVnd(fin.total_income) : "–"}</strong>
            </div>
            <div>
              <span className="ledger-totals-label">
                <i className="dot" style={{background: "#E9725F"}} /> Chi
              </span>
              <strong>{fin ? formatVnd(fin.total_expense) : "–"}</strong>
            </div>
            <div>
              <span className="ledger-totals-label">{fin && fin.profit < 0 ? "Lỗ" : "Lãi"}</span>
              <strong className={fin && fin.profit < 0 ? "down" : "up"}>{fin ? formatVnd(Math.abs(fin.profit)) : "–"}</strong>
            </div>
          </div>
          {fin == null ? (
            <div className="panel-body">
              <Skeleton height={140} />
            </div>
          ) : !hasLedger ? (
            <EmptyState icon={<IconCoins />} title={`Chưa có khoản thu – chi nào trong ${periodName}`} body="Nông hộ ghi thu – chi trên điện thoại (gõ hoặc nói vào mic); khoản mới hiện ở đây sau khi máy đồng bộ." />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Ngày</th>
                    <th>Khoản</th>
                    <th>Loại</th>
                    <th className="num">Số tiền</th>
                    {isAdmin ? <th aria-label="Thao tác" /> : null}
                  </tr>
                </thead>
                <tbody>
                  {ledger.map(e => (
                    <tr key={`${e.side}-${e.id}`}>
                      <td>{dayLabel(e.occurred_at)}</td>
                      <td className="wrap">
                        <div className="cell-main">{e.description}</div>
                        {e.note ? <div className="cell-sub">{e.note}</div> : null}
                      </td>
                      <td>
                        <Pill tone={e.side === "income" ? "green" : "coral"}>{e.side === "income" ? "Thu" : "Chi"}</Pill>
                        <div className="cell-sub">{kindLabel(e.side, e.kind)}</div>
                      </td>
                      <td className="num">
                        <span className={e.side === "income" ? "up" : undefined}>
                          {e.side === "income" ? "+" : "−"}
                          {formatVnd(e.amount)}
                        </span>
                      </td>
                      {isAdmin ? (
                        <td>
                          <RowActions busy={busyId === e.id} label={e.description} onEdit={() => setEditing({type: e.side, row: e})} onDelete={() => removeRow({type: e.side, row: e})} />
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Việc đang chờ" subtitle={`Theo giai đoạn chăm sóc hiện tại của từng lô, tính đến tháng ${cardMonth}.`} flush>
          {dash == null ? (
            <div className="panel-body">
              <Skeleton height={120} />
            </div>
          ) : dash.pending_groups.length === 0 ? (
            <EmptyState icon={<IconTasks />} title="Không có việc nào chờ" body="Các lô đang trồng đã làm hết việc của giai đoạn hiện tại." />
          ) : (
            <div className="list">
              {dash.pending_groups.map(g => (
                <div key={`${g.plot_id}-${g.stage_name}`} className="list-row">
                  <span className="stat-icon tone-amber" style={{width: 38, height: 38, borderRadius: 11}}>
                    <IconTasks size={18} />
                  </span>
                  <div className="list-row-main">
                    <div className="list-row-title">{g.plot_name}</div>
                    <div className="list-row-sub">
                      {g.crop_name} · {g.stage_name.split(" (")[0]}
                    </div>
                  </div>
                  <Pill tone="amber">{g.pending} việc</Pill>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className={isAdmin ? "grid grid-halves" : "grid"}>
        <Panel title="Tồn kho phân bón" subtitle="Nhập trừ xuất; giá trung bình theo các lần nhập." flush>
          {stock == null ? (
            <div className="panel-body">
              <Skeleton height={120} />
            </div>
          ) : stock.length === 0 ? (
            <EmptyState icon={<IconWarehouse />} title="Kho trống" body="Chưa có phiếu nhập phân bón nào." />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Phân bón</th>
                    <th className="num">Nhập</th>
                    <th className="num">Xuất</th>
                    <th className="num">Tồn (kg)</th>
                    <th className="num">Giá trị</th>
                  </tr>
                </thead>
                <tbody>
                  {stock.map(l => (
                    <tr key={l.fertilizer_id}>
                      <td>
                        <div className="cell-main">{l.fertilizer_name}</div>
                        <div className="cell-sub">TB {formatVnd(Math.round(l.avg_price))}/kg</div>
                      </td>
                      <td className="num">{kg(l.in_kg)}</td>
                      <td className="num">{kg(l.out_kg)}</td>
                      <td className="num cell-main">{kg(l.stock_kg)}</td>
                      <td className="num">{formatVnd(Math.round(l.stock_value))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        {isAdmin ? (
          <Panel title="Phiếu nhập – xuất kho" subtitle="Mọi phiếu, mới nhất trước." flush>
            {warehouseRows.length === 0 ? (
              <EmptyState icon={<IconWarehouse />} title="Chưa có phiếu nào" body="Phiếu nhập và xuất kho từ điện thoại hiện ở đây sau khi đồng bộ." />
            ) : (
              <div className="table-wrap table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Ngày</th>
                      <th>Phân bón</th>
                      <th className="num">Số lượng</th>
                      <th className="num">Thành tiền</th>
                      <th aria-label="Thao tác" />
                    </tr>
                  </thead>
                  <tbody>
                    {warehouseRows.map(({side, row, total}) => {
                      const target: EditTarget = side === "in" ? {type: "warehouseIn", row: row as WarehouseInRow} : {type: "warehouseOut", row: row as WarehouseOutRow};
                      return (
                        <tr key={`${side}-${row.id}`}>
                          <td>{dayLabel(row.occurred_at)}</td>
                          <td>
                            <div className="cell-main">{row.fertilizer_name}</div>
                            <div className="cell-sub">
                              <Pill tone={side === "in" ? "green" : "amber"}>{side === "in" ? "Nhập" : "Xuất"}</Pill>
                            </div>
                          </td>
                          <td className="num">
                            {kg(row.quantity_kg)} kg
                            <div className="cell-sub">{formatVnd(Math.round(row.unit_price))}/kg</div>
                          </td>
                          <td className="num">{formatVnd(Math.round(total))}</td>
                          <td>
                            <RowActions busy={busyId === row.id} label={row.fertilizer_name} onEdit={() => setEditing(target)} onDelete={() => removeRow(target)} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        ) : null}
      </div>

      {isAdmin ? (
        <Panel title="Kế hoạch vụ mùa" subtitle="Lưu từ máy tính chi phí phân bón trên điện thoại." flush>
          {plans.length === 0 ? (
            <EmptyState icon={<IconFarms />} title="Chưa có kế hoạch nào" body="Nông hộ lưu kế hoạch sau khi tính chi phí phân bón cho một lô." />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Ngày tạo</th>
                    <th>Cây / giống</th>
                    <th>Phương án</th>
                    <th className="num">Diện tích</th>
                    <th className="num">Chi phí dự tính</th>
                    <th aria-label="Thao tác" />
                  </tr>
                </thead>
                <tbody>
                  {plans.map(p => (
                    <tr key={p.id}>
                      <td>{dayLabel(p.created_at)}</td>
                      <td>
                        <div className="cell-main">{p.crop_name ?? p.crop_type}</div>
                        {p.variety_name ? <div className="cell-sub">{p.variety_name}</div> : null}
                      </td>
                      <td className="wrap">
                        {p.scenario_name}
                        {p.note ? <div className="cell-sub">{p.note}</div> : null}
                      </td>
                      <td className="num">
                        {p.area_input.toLocaleString("vi-VN")} {AREA_UNIT_SHORT[p.area_unit] ?? p.area_unit}
                      </td>
                      <td className="num">{p.cost_min != null && p.cost_max != null ? `${formatVnd(p.cost_min)} – ${formatVnd(p.cost_max)}` : "—"}</td>
                      <td>
                        <RowActions busy={busyId === p.id} label={p.scenario_name} onEdit={() => setEditing({type: "plan", row: p})} onDelete={() => removeRow({type: "plan", row: p})} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      ) : null}

      {editing ? (
        <EditModal
          target={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            setToast({message: "Đã lưu thay đổi"});
            reload();
          }}
        />
      ) : null}
      {toast ? <Toast message={toast.message} tone={toast.tone} onDone={() => setToast(null)} /> : null}
    </main>
  );
}

function RowActions({busy, label, onEdit, onDelete}: {busy: boolean; label: string; onEdit: () => void; onDelete: () => void}) {
  return (
    <div className="row-actions">
      <button className="btn btn-secondary btn-sm" type="button" disabled={busy} onClick={onEdit} aria-label={`Sửa ${label}`}>
        <IconEdit size={16} /> Sửa
      </button>
      <button className="btn btn-danger btn-sm" type="button" disabled={busy} onClick={onDelete} aria-label={`Xoá ${label}`} title="Xoá">
        <IconTrash size={16} />
      </button>
    </div>
  );
}

function EditModal({target, onClose, onSaved}: {target: EditTarget; onClose: () => void; onSaved: () => Promise<void>}) {
  const isLedger = target.type === "income" || target.type === "expense";
  const isWarehouse = target.type === "warehouseIn" || target.type === "warehouseOut";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [description, setDescription] = useState(isLedger ? target.row.description : "");
  const [amount, setAmount] = useState(isLedger ? String(target.row.amount) : "");
  const [kind, setKind] = useState(isLedger ? target.row.kind : "");
  const [checked, setChecked] = useState(isLedger ? target.row.checked : false);
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
        body = {scenario_name: scenarioName, cost_min: costMin === "" ? null : Number(costMin), cost_max: costMax === "" ? null : Number(costMax), note: note || null};
      }
      await api(pathFor(target), {method: "PATCH", body: JSON.stringify(body)});
      await onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Không lưu được thay đổi");
    } finally {
      setBusy(false);
    }
  };

  const dateField = (
    <label className="field">
      <span className="field-label">Ngày</span>
      <input className="input" type="date" value={occurredAt} onChange={e => setOccurredAt(e.target.value)} required />
    </label>
  );

  return (
    <Modal title={title} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="form-grid">
          {isLedger ? (
            <>
              <label className="field" style={{gridColumn: "1 / -1"}}>
                <span className="field-label">Mô tả</span>
                <input className="input" value={description} onChange={e => setDescription(e.target.value)} required />
              </label>
              <label className="field">
                <span className="field-label">Loại</span>
                <select className="input" value={kind} onChange={e => setKind(e.target.value)}>
                  {(target.type === "income" ? INCOME_KINDS : EXPENSE_KINDS).map(k => (
                    <option key={k.code} value={k.code}>
                      {k.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field-label">Số tiền (đồng)</span>
                <input className="input" type="number" min={0} value={amount} onChange={e => setAmount(e.target.value)} required />
              </label>
              {dateField}
              <label className="field" style={{justifyContent: "flex-end"}}>
                <span className="row" style={{minHeight: 42, gap: 8, fontWeight: 600}}>
                  <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} />
                  Đã kiểm tra
                </span>
              </label>
            </>
          ) : null}

          {target.type === "warehouseIn" ? (
            <>
              <label className="field" style={{gridColumn: "1 / -1"}}>
                <span className="field-label">Phân bón</span>
                <input className="input" value={fertilizerName} onChange={e => setFertilizerName(e.target.value)} required />
              </label>
              <label className="field">
                <span className="field-label">Số lượng</span>
                <input className="input" type="number" min={0} step="any" value={quantity} onChange={e => setQuantity(e.target.value)} required />
              </label>
              <label className="field">
                <span className="field-label">Đơn vị</span>
                <select className="input" value={unit} onChange={e => setUnit(e.target.value)}>
                  <option value="kg">kg</option>
                  <option value="tan">tấn</option>
                </select>
              </label>
              <label className="field">
                <span className="field-label">Tổng tiền (đồng)</span>
                <input className="input" type="number" min={0} value={price} onChange={e => setPrice(e.target.value)} required />
              </label>
              {dateField}
            </>
          ) : null}

          {target.type === "warehouseOut" ? (
            <>
              <label className="field" style={{gridColumn: "1 / -1"}}>
                <span className="field-label">Phân bón</span>
                <input className="input" value={fertilizerName} onChange={e => setFertilizerName(e.target.value)} required />
              </label>
              <label className="field">
                <span className="field-label">Số lượng (kg)</span>
                <input className="input" type="number" min={0} step="any" value={quantityKg} onChange={e => setQuantityKg(e.target.value)} required />
              </label>
              <label className="field">
                <span className="field-label">Đơn giá (đồng/kg)</span>
                <input className="input" type="number" min={0} value={unitPrice} onChange={e => setUnitPrice(e.target.value)} required />
              </label>
              {dateField}
            </>
          ) : null}

          {target.type === "plan" ? (
            <>
              <label className="field" style={{gridColumn: "1 / -1"}}>
                <span className="field-label">Phương án</span>
                <input className="input" value={scenarioName} onChange={e => setScenarioName(e.target.value)} required />
              </label>
              <label className="field">
                <span className="field-label">Chi phí thấp nhất (đồng)</span>
                <input className="input" type="number" min={0} value={costMin} onChange={e => setCostMin(e.target.value)} />
              </label>
              <label className="field">
                <span className="field-label">Chi phí cao nhất (đồng)</span>
                <input className="input" type="number" min={0} value={costMax} onChange={e => setCostMax(e.target.value)} />
              </label>
            </>
          ) : null}

          <label className="field" style={{gridColumn: "1 / -1"}}>
            <span className="field-label">Ghi chú</span>
            <input className="input" value={note} onChange={e => setNote(e.target.value)} />
          </label>
        </div>

        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? "Đang lưu…" : "Lưu thay đổi"}
          </button>
          <button className="btn btn-secondary" type="button" onClick={onClose}>
            Huỷ
          </button>
        </div>
      </form>
    </Modal>
  );
}
