"use client";

/**
 * Dashboard nông hộ trên web — the same three figures as the phone's home
 * screen (tồn kho · tháng này · công việc), read from the backend, plus the
 * stock table, recent thu/chi and the PDF export for a month or quarter.
 *
 * Layout: one column on a phone, two on a tablet, three cards across on a
 * desktop. Every control is a real button/select, so Tab + Enter works.
 */

import {useRouter} from "next/navigation";
import {useCallback, useEffect, useMemo, useState} from "react";

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

const now = new Date();
/** Joins non-empty query parts into "?a=1&b=2" (or "" when there are none). */
const qs = (...parts: string[]) => {
  const kept = parts.filter(Boolean);
  return kept.length ? `?${kept.join("&")}` : "";
};
const dayLabel = (ms: number) => new Date(ms).toLocaleDateString("vi-VN", {day: "2-digit", month: "2-digit"});

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
  const [error, setError] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfNote, setPdfNote] = useState<string | null>(null);

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

  // Figures for the chosen farm and period.
  useEffect(() => {
    if (!me || !ownerId) return;
    let cancelled = false;
    // The dashboard card is always "this month"; a quarter picks its last month.
    const cardMonth = periodKind === "month" ? month : quarter * 3;
    Promise.all([
      api<Dashboard>(`/dashboard/summary${qs(`year=${year}`, `month=${cardMonth}`, ownerQuery)}`),
      api<{lines: StockLine[]}>(`/warehouse/summary${qs(ownerQuery)}`),
      api<Financials>(`/reports/financials${qs(periodQuery, ownerQuery)}`),
    ])
      .then(([d, s, f]) => {
        if (cancelled) return;
        setError(null);
        setDash(d);
        setStock(s.lines);
        setFin(f);
      })
      .catch(e => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [me, ownerId, ownerQuery, periodQuery, year, month, quarter, periodKind]);

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
                      </tr>
                    </thead>
                    <tbody>
                      {[...fin.incomes.map(e => ({...e, side: "Thu"})), ...fin.expenses.map(e => ({...e, side: "Chi"}))]
                        .sort((a, b) => a.occurred_at - b.occurred_at)
                        .map(e => (
                          <tr key={`${e.side}-${e.id}`}>
                            <td>{dayLabel(e.occurred_at)}</td>
                            <td>
                              <span className={e.side === "Thu" ? "badge badge-green" : "badge badge-gray"}>{e.side}</span>
                            </td>
                            <td>{e.description}</td>
                            <td className="num">{formatVnd(e.amount)}</td>
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
    </main>
  );
}
