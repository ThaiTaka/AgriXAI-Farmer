"use client";

/**
 * Dashboard nông hộ trên web — the same three figures as the phone's home
 * screen (tồn kho · tháng này · công việc), read from the backend, plus the
 * stock table, recent thu/chi and the PDF export for a month or quarter.
 *
 * Admin also gets Sửa / Xoá on thu-chi, phiếu nhập-xuất kho và kế hoạch vụ
 * mùa — for fixing a farmer's typo or a duplicate entry from web-admin
 * instead of asking them to redo it on the phone (Task 2).
 *
 * Layout: one column on a phone, two on a tablet, three cards across on a
 * desktop. Every control is a real button/select, so Tab + Enter works.
 */

import Link from "next/link";
import {useRouter} from "next/navigation";
import {FormEvent, useCallback, useEffect, useMemo, useState} from "react";

import {api, apiBlob, ApiError, formatKg, formatVnd, getToken, setToken, type SessionUser} from "@/lib/api";

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

interface FarmUser {
  id: string;
  username: string;
  full_name: string;
  region: string | null;
  role: string;
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
const dayLabel = (ms: number) => new Date(ms).toLocaleDateString("vi-VN", {day: "2-digit", month: "2-digit"});
/** yyyy-mm-dd in Vietnam time, for an <input type="date"> value. */
const dateInputValue = (ms: number) => new Date(ms).toLocaleDateString("sv-SE", {timeZone: "Asia/Ho_Chi_Minh"});
/** The reverse conversion — noon Vietnam time avoids any UTC day-shift. */
const msFromDateInput = (value: string) => new Date(`${value}T12:00:00+07:00`).getTime();

export default function DashboardPage() {
  const router = useRouter();
  const [me, setMe] = useState<SessionUser | null>(null);
  const [users, setUsers] = useState<FarmUser[]>([]);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [periodKind, setPeriodKind] = useState<"month" | "quarter">("month");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [quarter, setQuarter] = useState(Math.floor(now.getMonth() / 3) + 1);
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [stock, setStock] = useState<StockLine[]>([]);
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

  const isAdmin = me?.role === "admin";
  const ownerQuery = useMemo(() => (ownerId && me && ownerId !== me.id ? `owner_id=${ownerId}` : ""), [ownerId, me]);
  const periodQuery = periodKind === "month" ? `year=${year}&month=${month}` : `year=${year}&quarter=${quarter}`;

  // Session + (admin) farm list.
  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    api<SessionUser>("/auth/me")
      .then(async user => {
        setMe(user);
        setOwnerId(user.id);
        if (user.role === "admin") {
          const list = await api<FarmUser[]>("/users");
          const farmers = list.filter(u => u.role === "farmer");
          setUsers(farmers);
          if (farmers[0]) setOwnerId(farmers[0].id);
        }
      })
      .catch(e => {
        if (e instanceof ApiError && e.status === 401) router.replace("/login");
        else setError(e instanceof Error ? e.message : String(e));
      });
  }, [router]);

  // Figures for the chosen farm and period, plus — for an admin — the raw
  // rows behind them so Sửa/Xoá has something to act on.
  const reload = useCallback(async () => {
    if (!me || !ownerId) return;
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
      if (me.role === "admin") {
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
  }, [me, ownerId, ownerQuery, periodQuery, year, month, quarter, periodKind]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await reload();
    })();
    return () => {
      cancelled = true;
    };
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
    if (!window.confirm(`Xoá ${labelFor(target)}? Không thể hoàn tác.`)) return;
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

  const signOut = () => {
    setToken(null);
    router.replace("/login");
  };

  if (!me) {
    return (
      <main className="page">
        <p className="muted">{error ?? "Đang tải…"}</p>
      </main>
    );
  }

  const loss = (dash?.month_profit ?? 0) < 0;
  const pendingText = dash && dash.pending_groups.length > 0
    ? dash.pending_groups
        .slice(0, 3)
        .map(g => `${g.crop_name} · ${g.stage_name.split(" (")[0]}: ${g.pending}`)
        .join("; ")
    : "Không có việc nào chờ ở giai đoạn hiện tại";

  const warehouseRows = [
    ...warehouseIn.map(r => ({...r, side: "Nhập" as const, quantity_kg: r.quantity_kg, unit_price: r.unit_price})),
    ...warehouseOut.map(r => ({...r, side: "Xuất" as const})),
  ].sort((a, b) => b.occurred_at - a.occurred_at);

  return (
    <main className="page">
      <header className="topbar">
        <div>
          <p className="eyebrow">AgriLog v2 · Quản trị</p>
          <h1 className="title">Xin chào {dash?.full_name ?? me.full_name}</h1>
          {dash?.region ? <p className="muted">{dash.region}</p> : null}
        </div>
        <div className="topbar-actions">
          {me.role === "admin" && users.length > 0 ? (
            <label className="label inline">
              Nông hộ
              <select className="input" value={ownerId ?? ""} onChange={e => setOwnerId(e.target.value)} aria-label="Chọn nông hộ">
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.username})
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {me.role === "admin" ? (
            <Link className="btn btn-secondary" href="/varieties">
              Duyệt giống cây
            </Link>
          ) : null}
          {me.role === "admin" ? (
            <Link className="btn btn-secondary" href="/fertilizer-prices">
              Giá phân bón
            </Link>
          ) : null}
          {me.role === "admin" ? (
            <Link className="btn btn-secondary" href="/accounts">
              Tài khoản
            </Link>
          ) : null}
          <Link className="btn btn-secondary" href="/settings">
            Cài đặt
          </Link>
          <button className="btn btn-secondary" type="button" onClick={signOut}>
            Đăng xuất
          </button>
        </div>
      </header>

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {actionNote ? <p className="muted small">{actionNote}</p> : null}

      <section className="cards" aria-label="Tóm tắt">
        <button type="button" className="card card-stat" onClick={() => document.getElementById("stock")?.scrollIntoView({behavior: "smooth"})}>
          <span className="eyebrow">Tồn kho</span>
          <span className="stat">{formatVnd(Math.round(dash?.stock_value ?? 0))}</span>
          <span className="muted small">
            {dash && dash.stock_kinds > 0 ? `${dash.stock_kinds} loại phân bón, ${formatKg(dash.stock_kg)}` : "Kho trống"}
          </span>
        </button>
        <button type="button" className="card card-stat" onClick={() => document.getElementById("finance")?.scrollIntoView({behavior: "smooth"})}>
          <span className="eyebrow">Tháng {dash?.month ?? month} này</span>
          <span className={loss ? "stat stat-negative" : "stat"}>
            {loss ? "Lỗ" : "Lãi"} {formatVnd(Math.abs(Math.round(dash?.month_profit ?? 0)))}
          </span>
          <span className="muted small">
            Thu {formatVnd(dash?.month_income ?? 0)}, Chi {formatVnd(dash?.month_expense ?? 0)}
          </span>
        </button>
        <div className="card card-stat" role="group" aria-label="Công việc">
          <span className="eyebrow">Công việc</span>
          <span className="stat">{dash ? `${dash.pending_tasks} việc giai đoạn này` : "—"}</span>
          <span className="muted small">{pendingText}</span>
        </div>
      </section>

      <section className="grid-2">
        <div className="card" id="stock">
          <h2 className="h2">Bảng tồn</h2>
          {stock.length === 0 ? (
            <p className="muted">Chưa có phiếu nhập nào.</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Phân bón</th>
                    <th scope="col" className="num">Nhập</th>
                    <th scope="col" className="num">Xuất</th>
                    <th scope="col" className="num">Tồn</th>
                    <th scope="col" className="num">Giá TB</th>
                    <th scope="col" className="num">Tổng tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {stock.map(l => (
                    <tr key={l.fertilizer_id}>
                      <td>{l.fertilizer_name}</td>
                      <td className="num">{l.in_kg}</td>
                      <td className="num">{l.out_kg}</td>
                      <td className="num strong">{l.stock_kg}</td>
                      <td className="num">{formatVnd(Math.round(l.avg_price))}</td>
                      <td className="num">{formatVnd(Math.round(l.stock_value))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card" id="finance">
          <div className="row-between">
            <h2 className="h2">Báo cáo thu – chi</h2>
            <div className="period" role="group" aria-label="Kỳ báo cáo">
              <select className="input" value={periodKind} onChange={e => setPeriodKind(e.target.value as "month" | "quarter")} aria-label="Loại kỳ">
                <option value="month">Tháng</option>
                <option value="quarter">Quý</option>
              </select>
              {periodKind === "month" ? (
                <select className="input" value={month} onChange={e => setMonth(Number(e.target.value))} aria-label="Tháng">
                  {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                    <option key={m} value={m}>
                      Tháng {m}
                    </option>
                  ))}
                </select>
              ) : (
                <select className="input" value={quarter} onChange={e => setQuarter(Number(e.target.value))} aria-label="Quý">
                  {[1, 2, 3, 4].map(q => (
                    <option key={q} value={q}>
                      Quý {q}
                    </option>
                  ))}
                </select>
              )}
              <select className="input" value={year} onChange={e => setYear(Number(e.target.value))} aria-label="Năm">
                {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {fin ? (
            <>
              <dl className="totals">
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
                  <dd className={fin.profit < 0 ? "stat-negative" : "stat-positive"}>{formatVnd(fin.profit)}</dd>
                </div>
              </dl>
              {fin.incomes.length + fin.expenses.length === 0 ? (
                <p className="muted">Không có dữ liệu tháng này.</p>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th scope="col">Ngày</th>
                        <th scope="col">Loại</th>
                        <th scope="col">Mô tả</th>
                        <th scope="col" className="num">Số tiền</th>
                        {isAdmin ? <th scope="col">Hành động</th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ...fin.incomes.map(e => ({...e, side: "Thu" as const, kindOf: "income" as const})),
                        ...fin.expenses.map(e => ({...e, side: "Chi" as const, kindOf: "expense" as const})),
                      ]
                        .sort((a, b) => a.occurred_at - b.occurred_at)
                        .map(e => (
                          <tr key={`${e.side}-${e.id}`}>
                            <td>{dayLabel(e.occurred_at)}</td>
                            <td>
                              <span className={e.side === "Thu" ? "badge badge-green" : "badge badge-gray"}>{e.side}</span>
                            </td>
                            <td>
                              {e.description}
                              <span className="muted small"> · {kindLabel(e.kindOf, e.kind)}</span>
                            </td>
                            <td className="num">{formatVnd(e.amount)}</td>
                            {isAdmin ? (
                              <td>
                                <div className="row-actions">
                                  <button
                                    className="btn btn-secondary"
                                    type="button"
                                    disabled={busyId === e.id}
                                    onClick={() => setEditing({type: e.kindOf, row: e})}
                                  >
                                    Sửa
                                  </button>
                                  <button
                                    className="btn btn-danger"
                                    type="button"
                                    disabled={busyId === e.id}
                                    onClick={() => removeRow({type: e.kindOf, row: e})}
                                  >
                                    Xoá
                                  </button>
                                </div>
                              </td>
                            ) : null}
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="row-between pdf-row">
                <button className="btn btn-primary" type="button" onClick={exportPdf} disabled={pdfBusy || fin.incomes.length + fin.expenses.length === 0}>
                  {pdfBusy ? "Đang tạo PDF…" : "Xuất PDF"}
                </button>
                {pdfNote ? <span className="muted small">{pdfNote}</span> : null}
              </div>
            </>
          ) : (
            <p className="muted">Đang tải…</p>
          )}
        </div>
      </section>

      {isAdmin ? (
        <>
          <div className="card" id="warehouse-rows">
            <h2 className="h2">Phiếu nhập – xuất kho</h2>
            {warehouseRows.length === 0 ? (
              <p className="muted">Chưa có phiếu nhập/xuất nào.</p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Ngày</th>
                      <th scope="col">Loại</th>
                      <th scope="col">Phân bón</th>
                      <th scope="col" className="num">Số lượng (kg)</th>
                      <th scope="col" className="num">Đơn giá</th>
                      <th scope="col">Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {warehouseRows.map(r => {
                      const target: EditTarget =
                        r.side === "Nhập"
                          ? {type: "warehouseIn", row: r as WarehouseInRow}
                          : {type: "warehouseOut", row: r as WarehouseOutRow};
                      return (
                        <tr key={`${r.side}-${r.id}`}>
                          <td>{dayLabel(r.occurred_at)}</td>
                          <td>
                            <span className={r.side === "Nhập" ? "badge badge-green" : "badge badge-gray"}>{r.side}</span>
                          </td>
                          <td>{r.fertilizer_name}</td>
                          <td className="num">{r.quantity_kg}</td>
                          <td className="num">{formatVnd(Math.round(r.unit_price))}</td>
                          <td>
                            <div className="row-actions">
                              <button
                                className="btn btn-secondary"
                                type="button"
                                disabled={busyId === r.id}
                                onClick={() => setEditing(target)}
                              >
                                Sửa
                              </button>
                              <button
                                className="btn btn-danger"
                                type="button"
                                disabled={busyId === r.id}
                                onClick={() => removeRow(target)}
                              >
                                Xoá
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card" id="plans">
            <h2 className="h2">Kế hoạch vụ mùa</h2>
            {plans.length === 0 ? (
              <p className="muted">Chưa có kế hoạch nào.</p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Ngày tạo</th>
                      <th scope="col">Cây / giống</th>
                      <th scope="col">Phương án</th>
                      <th scope="col" className="num">Diện tích</th>
                      <th scope="col" className="num">Chi phí</th>
                      <th scope="col">Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plans.map(p => (
                      <tr key={p.id}>
                        <td>{dayLabel(p.created_at)}</td>
                        <td>
                          {p.crop_name ?? p.crop_type}
                          {p.variety_name ? ` · ${p.variety_name}` : ""}
                        </td>
                        <td>{p.scenario_name}</td>
                        <td className="num">{p.area_input} {p.area_unit}</td>
                        <td className="num">
                          {p.cost_min != null && p.cost_max != null
                            ? `${formatVnd(p.cost_min)} – ${formatVnd(p.cost_max)}`
                            : "—"}
                        </td>
                        <td>
                          <div className="row-actions">
                            <button
                              className="btn btn-secondary"
                              type="button"
                              disabled={busyId === p.id}
                              onClick={() => setEditing({type: "plan", row: p})}
                            >
                              Sửa
                            </button>
                            <button
                              className="btn btn-danger"
                              type="button"
                              disabled={busyId === p.id}
                              onClick={() => removeRow({type: "plan", row: p})}
                            >
                              Xoá
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
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
    </main>
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
  const [occurredAt, setOccurredAt] = useState(
    isLedger || isWarehouse ? dateInputValue(target.row.occurred_at) : "",
  );
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
        body = {
          kind,
          description,
          amount: Number(amount),
          occurred_at: msFromDateInput(occurredAt),
          note: note || null,
          checked,
        };
      } else if (target.type === "warehouseIn") {
        body = {
          fertilizer_name: fertilizerName,
          quantity: Number(quantity),
          unit,
          price: Number(price),
          occurred_at: msFromDateInput(occurredAt),
          note: note || null,
        };
      } else if (target.type === "warehouseOut") {
        body = {
          fertilizer_name: fertilizerName,
          quantity_kg: Number(quantityKg),
          unit_price: Number(unitPrice),
          occurred_at: msFromDateInput(occurredAt),
          note: note || null,
        };
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
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}>
        <h2 className="h2">{title}</h2>
        <form className="form" onSubmit={submit}>
          {target.type === "income" || target.type === "expense" ? (
            <>
              <label className="label" htmlFor="edit-kind">Loại</label>
              <select id="edit-kind" className="input" value={kind} onChange={e => setKind(e.target.value)}>
                {(target.type === "income" ? INCOME_KINDS : EXPENSE_KINDS).map(k => (
                  <option key={k.code} value={k.code}>
                    {k.label}
                  </option>
                ))}
              </select>
              <label className="label" htmlFor="edit-description">Mô tả</label>
              <input id="edit-description" className="input" value={description} onChange={e => setDescription(e.target.value)} required />
              <div className="field-row">
                <div>
                  <label className="label" htmlFor="edit-amount">Số tiền (đồng)</label>
                  <input id="edit-amount" className="input" type="number" min={0} value={amount} onChange={e => setAmount(e.target.value)} required />
                </div>
                <div>
                  <label className="label" htmlFor="edit-date">Ngày</label>
                  <input id="edit-date" className="input" type="date" value={occurredAt} onChange={e => setOccurredAt(e.target.value)} required />
                </div>
              </div>
              <label className="label inline" style={{flexDirection: "row", alignItems: "center", gap: "8px", minWidth: "auto"}}>
                <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} />
                Đã kiểm tra
              </label>
            </>
          ) : null}

          {target.type === "warehouseIn" ? (
            <>
              <label className="label" htmlFor="edit-fertilizer">Phân bón</label>
              <input id="edit-fertilizer" className="input" value={fertilizerName} onChange={e => setFertilizerName(e.target.value)} required />
              <div className="field-row">
                <div>
                  <label className="label" htmlFor="edit-quantity">Số lượng</label>
                  <input id="edit-quantity" className="input" type="number" min={0} step="any" value={quantity} onChange={e => setQuantity(e.target.value)} required />
                </div>
                <div>
                  <label className="label" htmlFor="edit-unit">Đơn vị</label>
                  <select id="edit-unit" className="input" value={unit} onChange={e => setUnit(e.target.value)}>
                    <option value="kg">kg</option>
                    <option value="tan">tấn</option>
                  </select>
                </div>
              </div>
              <div className="field-row">
                <div>
                  <label className="label" htmlFor="edit-price">Tổng tiền (đồng)</label>
                  <input id="edit-price" className="input" type="number" min={0} value={price} onChange={e => setPrice(e.target.value)} required />
                </div>
                <div>
                  <label className="label" htmlFor="edit-date">Ngày</label>
                  <input id="edit-date" className="input" type="date" value={occurredAt} onChange={e => setOccurredAt(e.target.value)} required />
                </div>
              </div>
            </>
          ) : null}

          {target.type === "warehouseOut" ? (
            <>
              <label className="label" htmlFor="edit-fertilizer">Phân bón</label>
              <input id="edit-fertilizer" className="input" value={fertilizerName} onChange={e => setFertilizerName(e.target.value)} required />
              <div className="field-row">
                <div>
                  <label className="label" htmlFor="edit-quantity-kg">Số lượng (kg)</label>
                  <input id="edit-quantity-kg" className="input" type="number" min={0} step="any" value={quantityKg} onChange={e => setQuantityKg(e.target.value)} required />
                </div>
                <div>
                  <label className="label" htmlFor="edit-unit-price">Đơn giá (đồng/kg)</label>
                  <input id="edit-unit-price" className="input" type="number" min={0} value={unitPrice} onChange={e => setUnitPrice(e.target.value)} required />
                </div>
              </div>
              <label className="label" htmlFor="edit-date">Ngày</label>
              <input id="edit-date" className="input" type="date" value={occurredAt} onChange={e => setOccurredAt(e.target.value)} required />
            </>
          ) : null}

          {target.type === "plan" ? (
            <>
              <label className="label" htmlFor="edit-scenario">Phương án</label>
              <input id="edit-scenario" className="input" value={scenarioName} onChange={e => setScenarioName(e.target.value)} required />
              <div className="field-row">
                <div>
                  <label className="label" htmlFor="edit-cost-min">Chi phí thấp nhất</label>
                  <input id="edit-cost-min" className="input" type="number" min={0} value={costMin} onChange={e => setCostMin(e.target.value)} />
                </div>
                <div>
                  <label className="label" htmlFor="edit-cost-max">Chi phí cao nhất</label>
                  <input id="edit-cost-max" className="input" type="number" min={0} value={costMax} onChange={e => setCostMax(e.target.value)} />
                </div>
              </div>
            </>
          ) : null}

          {target.type === "plan" || isWarehouse || isLedger ? (
            <>
              <label className="label" htmlFor="edit-note">Ghi chú</label>
              <input id="edit-note" className="input" value={note} onChange={e => setNote(e.target.value)} />
            </>
          ) : null}

          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="row-between">
            <button className="btn btn-secondary" type="button" onClick={onClose}>
              Huỷ
            </button>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? "Đang lưu…" : "Lưu"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
