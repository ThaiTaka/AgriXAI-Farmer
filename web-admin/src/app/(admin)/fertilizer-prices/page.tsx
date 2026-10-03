"use client";

/**
 * Giá phân bón — the price per kg every phone uses in the fertilizer
 * calculator and the stock value.
 *
 * Prices are append-only: each "Nhập giá" adds a row (POST /fertilizer-prices)
 * and the newest one already in effect is the current price; a product with no
 * row yet uses the survey average from shared/data (sourced, dated). Every new
 * price also notifies the farms, several in a row folded into one notice.
 * A price for a later date waits in the history until that day.
 */

import {FormEvent, useCallback, useEffect, useMemo, useState} from "react";

import {useAdmin} from "@/components/AdminShell";
import {IconBell, IconCoins, IconPlus, IconPrice, IconRefresh, IconSearch} from "@/components/icons";
import {EmptyState, Modal, PageHeader, Panel, Pill, Skeleton, StatCard, Toast} from "@/components/ui";
import {api, ApiError, formatVnd} from "@/lib/api";
import {timeAgo} from "@/lib/format";
import {useNow} from "@/lib/useNow";

interface PriceRow {
  id: number;
  fertilizer_id: string;
  fertilizer_name: string;
  group: string | null;
  group_name: string | null;
  npk_ratio: string | null;
  pack: string | null;
  price_per_kg: number;
  effective_from: number; // epoch ms; 0 = survey price from the catalogue
  updated_by: string | null;
  created_at: number;
  survey_min: number | null;
  survey_max: number | null;
  survey_avg: number | null;
  survey_source: string | null;
  survey_date: string | null;
}

const dateLabel = (ms: number) => new Date(ms).toLocaleDateString("vi-VN", {day: "2-digit", month: "2-digit", year: "numeric"});
/** yyyy-mm-dd of today in Vietnam time. */
const todayInput = () => new Date().toLocaleDateString("sv-SE", {timeZone: "Asia/Ho_Chi_Minh"});
/** Midnight Vietnam time of an <input type="date"> value, so "today" is in effect at once. */
const msFromDateInput = (value: string) => new Date(`${value}T00:00:00+07:00`).getTime();
const surveyDate = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : null);

/** How far a price sits from the survey average, as a signed percentage. */
function versusSurvey(price: number, avg: number | null): {text: string; tone: "gray" | "amber" | "blue"} | null {
  if (!avg) return null;
  const pct = Math.round(((price - avg) / avg) * 100);
  if (pct === 0) return {text: "bằng TB khảo sát", tone: "gray"};
  return {text: `${pct > 0 ? "+" : "−"}${Math.abs(pct)}% so với TB`, tone: pct > 0 ? "amber" : "blue"};
}

export default function FertilizerPricesPage() {
  const {me} = useAdmin();
  const [prices, setPrices] = useState<PriceRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [group, setGroup] = useState("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<PriceRow | "new" | null>(null);
  const [historyOf, setHistoryOf] = useState<PriceRow | null>(null);

  const load = useCallback(
    () =>
      api<PriceRow[]>("/fertilizer-prices/latest")
        .then(setPrices)
        .catch(e => setError(e instanceof Error ? e.message : String(e))),
    [],
  );

  useEffect(() => {
    load();
  }, [load]);

  const groups = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of prices ?? []) if (p.group) seen.set(p.group, p.group_name ?? p.group);
    return [...seen.entries()];
  }, [prices]);

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("vi");
    return (prices ?? []).filter(p => (group === "all" || p.group === group) && (!q || `${p.fertilizer_name} ${p.npk_ratio ?? ""}`.toLocaleLowerCase("vi").includes(q)));
  }, [prices, group, query]);

  const updated = (prices ?? []).filter(p => p.id > 0);
  const lastUpdate = updated.reduce((max, p) => Math.max(max, p.created_at), 0);
  const placeholder = <Skeleton height={28} width={48} />;

  return (
    <main className="page">
      <PageHeader
        title="Giá phân bón"
        subtitle="Giá mỗi kg mà điện thoại nông hộ dùng để tính chi phí bón phân và giá trị tồn kho. Nhập giá mới thì các nông hộ nhận thông báo."
        actions={
          <button className="btn btn-primary" type="button" onClick={() => setEditing("new")} disabled={!prices}>
            <IconPlus size={18} /> Nhập giá mới
          </button>
        }
      />
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid grid-kpi">
        <StatCard label="Loại phân có giá" tone="green" icon={<IconPrice size={22} />} value={prices ? prices.length : placeholder} sub={`${groups.length} nhóm phân bón`} />
        <StatCard label="Quản trị viên đã nhập" tone="blue" icon={<IconCoins size={22} />} value={prices ? updated.length : placeholder} sub="Đang dùng giá nhập trên web" />
        <StatCard label="Dùng giá khảo sát" tone="gray" icon={<IconSearch size={22} />} value={prices ? prices.length - updated.length : placeholder} sub="Trung bình từ nguồn đã trích dẫn" />
        <StatCard label="Cập nhật gần nhất" tone="lime" icon={<IconRefresh size={22} />} value={prices ? (lastUpdate ? timeAgo(lastUpdate) : "Chưa có") : placeholder} sub={lastUpdate ? dateLabel(lastUpdate) : "Chưa nhập giá nào trên web"} />
      </div>

      <Panel
        title="Bảng giá đang dùng"
        subtitle="So với khoảng giá khảo sát thị trường của từng loại."
        action={
          <div className="toolbar">
            <select className="input" value={group} onChange={e => setGroup(e.target.value)} aria-label="Nhóm phân bón">
              <option value="all">Mọi nhóm phân</option>
              {groups.map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
            <label className="search">
              <IconSearch size={18} />
              <input className="input" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm phân bón" aria-label="Tìm phân bón" />
            </label>
          </div>
        }
        flush>
        {prices == null ? (
          <div className="panel-body">
            <Skeleton height={220} />
          </div>
        ) : visible.length === 0 ? (
          <EmptyState icon={<IconPrice />} title="Không có loại phân nào khớp" body="Thử chọn nhóm khác hoặc bỏ bớt từ tìm kiếm." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Phân bón</th>
                  <th className="num">Giá đang dùng</th>
                  <th>Nguồn giá</th>
                  <th>Khảo sát thị trường</th>
                  <th aria-label="Thao tác" />
                </tr>
              </thead>
              <tbody>
                {visible.map(p => {
                  const diff = p.id > 0 ? versusSurvey(p.price_per_kg, p.survey_avg) : null;
                  return (
                    <tr key={p.fertilizer_id}>
                      <td>
                        <div className="cell-main">{p.fertilizer_name}</div>
                        <div className="cell-sub">
                          {p.group_name ?? p.group ?? "Khác"}
                          {p.npk_ratio ? ` · NPK ${p.npk_ratio}` : ""}
                          {p.pack ? ` · ${p.pack}` : ""}
                        </div>
                      </td>
                      <td className="num">
                        <div className="cell-main" style={{fontSize: 15}}>{formatVnd(p.price_per_kg)}/kg</div>
                        {diff ? (
                          <div className="cell-sub">
                            <Pill tone={diff.tone}>{diff.text}</Pill>
                          </div>
                        ) : null}
                      </td>
                      <td>
                        {p.id > 0 ? (
                          <>
                            <Pill tone="green">Quản trị nhập</Pill>
                            <div className="cell-sub">Từ {dateLabel(p.effective_from)}</div>
                          </>
                        ) : (
                          <>
                            <Pill tone="gray">TB khảo sát</Pill>
                            <div className="cell-sub">Chưa nhập giá trên web</div>
                          </>
                        )}
                      </td>
                      <td className="wrap" style={{maxWidth: 320}}>
                        {p.survey_min != null && p.survey_max != null ? (
                          <>
                            <div>
                              {formatVnd(p.survey_min)} – {formatVnd(p.survey_max)}/kg
                            </div>
                            <div className="cell-sub">
                              {p.survey_source}
                              {p.survey_date ? ` · ${surveyDate(p.survey_date)}` : ""}
                            </div>
                          </>
                        ) : (
                          <span className="text-muted">Không có dữ liệu khảo sát</span>
                        )}
                      </td>
                      <td>
                        <div className="row-actions" style={{justifyContent: "flex-end"}}>
                          <button className="btn btn-ghost btn-sm" type="button" onClick={() => setHistoryOf(p)}>
                            Lịch sử
                          </button>
                          <button className="btn btn-secondary btn-sm" type="button" onClick={() => setEditing(p)}>
                            Nhập giá
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
      </Panel>

      {editing && prices ? (
        <PriceModal
          prices={prices}
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async message => {
            setEditing(null);
            setToast(message);
            await load();
          }}
        />
      ) : null}
      {historyOf ? <HistoryModal row={historyOf} myId={me.id} myName={me.full_name} onClose={() => setHistoryOf(null)} /> : null}
      {toast ? <Toast message={toast} onDone={() => setToast(null)} /> : null}
    </main>
  );
}

function PriceModal({prices, initial, onClose, onSaved}: {prices: PriceRow[]; initial: PriceRow | null; onClose: () => void; onSaved: (message: string) => Promise<void>}) {
  const [fertilizerId, setFertilizerId] = useState(initial?.fertilizer_id ?? prices[0]?.fertilizer_id ?? "");
  const [price, setPrice] = useState("");
  const [date, setDate] = useState(todayInput());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const row = prices.find(p => p.fertilizer_id === fertilizerId);
  const value = Number(price.replace(/[.\s]/g, "").replace(",", "."));
  const diff = row && value > 0 ? versusSurvey(value, row.survey_avg) : null;
  const effective = date ? msFromDateInput(date) : 0;
  const now = useNow();
  const later = effective > now;

  const byGroup = useMemo(() => {
    const map = new Map<string, PriceRow[]>();
    for (const p of prices) {
      const key = p.group_name ?? p.group ?? "Khác";
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    return [...map.entries()];
  }, [prices]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!row) return setError("Chọn loại phân bón");
    if (!(value > 0)) return setError("Giá phải là số dương, tính theo đồng/kg");
    if (!date) return setError("Chọn ngày bắt đầu áp dụng");
    setBusy(true);
    try {
      await api("/fertilizer-prices", {method: "POST", body: JSON.stringify({fertilizer_id: row.fertilizer_id, price_per_kg: value, effective_from: effective})});
      await onSaved(
        later
          ? `Đã lưu giá ${row.fertilizer_name} — áp dụng từ ${dateLabel(effective)}, tới hôm đó vẫn dùng giá cũ`
          : `Đã cập nhật giá ${row.fertilizer_name}: ${formatVnd(value)}/kg — nông hộ nhận thông báo sau lần đồng bộ tới`,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không lưu được giá");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={initial ? `Nhập giá mới · ${initial.fertilizer_name}` : "Nhập giá mới"} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label className="field">
          <span className="field-label">Loại phân bón</span>
          <select className="input" value={fertilizerId} onChange={e => setFertilizerId(e.target.value)} disabled={initial != null}>
            {byGroup.map(([name, rows]) => (
              <optgroup key={name} label={name}>
                {rows.map(p => (
                  <option key={p.fertilizer_id} value={p.fertilizer_id}>
                    {p.fertilizer_name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {row ? (
            <span className="field-hint">
              Đang dùng {formatVnd(row.price_per_kg)}/kg ({row.id > 0 ? `nhập ngày ${dateLabel(row.effective_from)}` : "TB khảo sát"})
              {row.survey_min != null && row.survey_max != null ? ` · khảo sát ${formatVnd(row.survey_min)} – ${formatVnd(row.survey_max)}/kg` : ""}
            </span>
          ) : null}
        </label>
        <div className="form-grid">
          <label className="field">
            <span className="field-label">Giá mới (đồng/kg)</span>
            <input className="input" inputMode="numeric" value={price} onChange={e => setPrice(e.target.value)} placeholder={row?.survey_avg ? `VD: ${row.survey_avg.toLocaleString("vi-VN")}` : "VD: 13000"} autoFocus required />
            {diff ? <span className="field-hint">{diff.text} khảo sát</span> : null}
          </label>
          <label className="field">
            <span className="field-label">Áp dụng từ ngày</span>
            <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} required />
            {later ? <span className="field-hint">Ngày sau: tới hôm đó điện thoại vẫn dùng giá đang có.</span> : null}
          </label>
        </div>
        <div className="alert-box info" style={{marginTop: 4}}>
          <IconBell size={18} />
          <div className="alert-body">Mỗi giá mới là một dòng lịch sử, không sửa hay xoá được. Mọi nông hộ nhận một thông báo; nhiều giá nhập liền nhau được gộp lại.</div>
        </div>
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? "Đang lưu…" : "Lưu giá"}
          </button>
          <button className="btn btn-secondary" type="button" onClick={onClose}>
            Huỷ
          </button>
        </div>
      </form>
    </Modal>
  );
}

function HistoryModal({row, myId, myName, onClose}: {row: PriceRow; myId: string; myName: string; onClose: () => void}) {
  const [history, setHistory] = useState<PriceRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<PriceRow[]>(`/fertilizer-prices/history/${encodeURIComponent(row.fertilizer_id)}`)
      .then(setHistory)
      .catch(e => setError(e instanceof Error ? e.message : String(e)));
  }, [row.fertilizer_id]);

  const now = useNow();
  // Newest first; the current one is the first already in effect.
  const currentId = history?.find(h => h.effective_from <= now)?.id;

  return (
    <Modal title={`Lịch sử giá · ${row.fertilizer_name}`} onClose={onClose} wide>
      {error ? <p className="error">{error}</p> : null}
      {history == null && !error ? (
        <Skeleton height={140} />
      ) : history && history.length === 0 ? (
        <EmptyState
          icon={<IconPrice />}
          title="Chưa nhập giá nào trên web"
          body={
            row.survey_avg != null
              ? `Điện thoại đang dùng giá trung bình khảo sát ${formatVnd(row.survey_avg)}/kg (${row.survey_source ?? "nguồn khảo sát"}${row.survey_date ? `, ${surveyDate(row.survey_date)}` : ""}).`
              : "Điện thoại đang dùng giá khảo sát trong danh mục."
          }
        />
      ) : history ? (
        <div className="table-wrap" style={{border: "1px solid var(--admin-line)", borderRadius: 12, overflow: "hidden"}}>
          <table className="table">
            <thead>
              <tr>
                <th>Áp dụng từ</th>
                <th className="num">Giá</th>
                <th className="num">Thay đổi</th>
                <th>Người nhập</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h, i) => {
                const older = history[i + 1];
                const change = older ? h.price_per_kg - older.price_per_kg : null;
                return (
                  <tr key={h.id}>
                    <td>
                      {dateLabel(h.effective_from)}
                      <div className="cell-sub">nhập {timeAgo(h.created_at)}</div>
                    </td>
                    <td className="num cell-main">{formatVnd(h.price_per_kg)}/kg</td>
                    <td className="num">
                      {change == null ? <span className="text-muted">—</span> : change === 0 ? "0" : <span className={change > 0 ? "down" : "up"}>{`${change > 0 ? "+" : "−"}${formatVnd(Math.abs(change))}`}</span>}
                    </td>
                    <td>{h.updated_by === myId ? myName : "Quản trị viên"}</td>
                    <td>{h.id === currentId ? <Pill tone="green">Đang dùng</Pill> : h.effective_from > now ? <Pill tone="blue">Từ {dateLabel(h.effective_from)}</Pill> : <Pill tone="gray">Đã thay</Pill>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
      {history && history.length > 0 && row.survey_avg != null ? (
        <p className="text-sm text-muted" style={{marginTop: 12}}>
          Trung bình khảo sát: {formatVnd(row.survey_avg)}/kg · {row.survey_source}
          {row.survey_date ? `, ${surveyDate(row.survey_date)}` : ""}.
        </p>
      ) : null}
    </Modal>
  );
}
