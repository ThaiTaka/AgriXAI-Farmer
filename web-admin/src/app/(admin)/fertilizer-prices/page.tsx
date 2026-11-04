"use client";

/**
 * Giá phân bón — chỉ quản trị viên được nhập giá, mọi người đọc được.
 *
 * Thiết kế append-only: mỗi lần cập nhật là một dòng mới trong DB, không sửa
 * hay xoá dòng cũ. Giá hiện hành = dòng có effective_from lớn nhất của từng loại
 * phân; loại chưa có dòng nào lấy giá khảo sát trong
 * shared/data/fertilizer_recommendations.json.
 *
 * Endpoint:
 *   GET  /fertilizer-prices/latest          → giá hiện hành (kèm giá khảo sát dự phòng)
 *   POST /fertilizer-prices                 → quản trị viên nhập giá mới (201)
 *   GET  /fertilizer-prices/history/{id}    → lịch sử giá của một loại phân
 */

import {FormEvent, useCallback, useEffect, useMemo, useState} from "react";

import {Icon} from "@/components/admin/Icon";
import {useAdmin} from "@/components/admin/Shell";
import {
  EmptyState,
  Field,
  FilterSelect,
  Modal,
  Notice,
  PageHeader,
  Pager,
  Panel,
  Pill,
  SearchBox,
  TableSkeleton,
  usePaged,
} from "@/components/admin/ui";
import {api, ApiError, formatDate, formatVnd} from "@/lib/api";
import {fold} from "@/lib/format";

interface FertilizerPriceRow {
  id: number;
  fertilizer_id: string;
  fertilizer_name: string;
  group: string | null;
  price_per_kg: number;
  effective_from: number; // epoch ms; 0 = giá từ JSON catalogue
  updated_by: string | null;
  created_at: number;
}

const GROUP_LABELS: Record<string, string> = {
  dam: "Đạm",
  lan: "Lân",
  kali: "Kali",
  npk: "NPK",
  huu_co: "Hữu cơ",
  vi_sinh: "Vi sinh / vi lượng",
};

const groupLabel = (group: string | null) => (group ? (GROUP_LABELS[group] ?? group) : "Khác");

const todayInput = () => new Date().toLocaleDateString("sv-SE", {timeZone: "Asia/Ho_Chi_Minh"});

export default function FertilizerPricesPage() {
  const {isAdmin} = useAdmin();
  const [prices, setPrices] = useState<FertilizerPriceRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("all");
  const [pricing, setPricing] = useState<FertilizerPriceRow | "new" | null>(null);
  const [history, setHistory] = useState<FertilizerPriceRow | null>(null);

  const load = useCallback(async () => {
    try {
      setPrices(await api<FertilizerPriceRow[]>("/fertilizer-prices/latest"));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    // `load` chỉ setState sau khi yêu cầu mạng trả về.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const groupOptions = useMemo(() => {
    const keys = [...new Set((prices ?? []).map(p => p.group ?? "other"))];
    return [{value: "all", label: "Tất cả nhóm"}, ...keys.map(k => ({value: k, label: groupLabel(k === "other" ? null : k)}))];
  }, [prices]);

  const filtered = useMemo(() => {
    const q = fold(query.trim());
    return (prices ?? [])
      .filter(p => (group === "all" ? true : (p.group ?? "other") === group))
      .filter(p => !q || fold(`${p.fertilizer_name} ${p.fertilizer_id}`).includes(q))
      .sort((a, b) => groupLabel(a.group).localeCompare(groupLabel(b.group), "vi") || a.fertilizer_name.localeCompare(b.fertilizer_name, "vi"));
  }, [prices, query, group]);

  const paged = usePaged(filtered, 10);
  const updated = (prices ?? []).filter(p => p.id !== -1).length;

  return (
    <>
      <PageHeader
        title="Giá phân bón"
        subtitle={
          prices
            ? `${prices.length} loại phân · ${updated} loại đã được quản trị viên cập nhật, còn lại dùng giá khảo sát trong danh mục`
            : "Đang tải…"
        }
        actions={
          isAdmin ? (
            <button className="btn btn-primary" type="button" onClick={() => setPricing("new")}>
              <Icon name="plus" size={16} />
              Nhập giá mới
            </button>
          ) : undefined
        }
      />
      {error ? <Notice>{error}</Notice> : null}
      {note ? <Notice tone="green">{note}</Notice> : null}

      <Panel flush>
        <div className="toolbar">
          <SearchBox value={query} onChange={setQuery} placeholder="Tìm theo tên hoặc mã phân bón…" label="Tìm phân bón" />
          <FilterSelect label="Nhóm" value={group} onChange={setGroup} options={groupOptions} />
        </div>

        {prices === null && !error ? (
          <TableSkeleton rows={8} cols={5} />
        ) : filtered.length === 0 ? (
          <EmptyState icon="prices" title="Không có loại phân nào khớp" />
        ) : (
          <>
            <div className="data-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Phân bón</th>
                    <th>Nhóm</th>
                    <th className="num">Giá hiện hành</th>
                    <th>Hiệu lực từ</th>
                    <th>Nguồn giá</th>
                    {isAdmin ? <th aria-label="Thao tác" /> : null}
                  </tr>
                </thead>
                <tbody>
                  {paged.slice.map(r => (
                    <tr key={r.fertilizer_id}>
                      <td>
                        <span className="cell-main">{r.fertilizer_name}</span>
                        <span className="cell-sub mono">{r.fertilizer_id}</span>
                      </td>
                      <td>{groupLabel(r.group)}</td>
                      <td className="num">
                        <strong>{formatVnd(r.price_per_kg)}</strong>
                        <span className="cell-sub">đồng/kg</span>
                      </td>
                      <td className="nowrap">{formatDate(r.effective_from)}</td>
                      <td>{r.id === -1 ? <Pill tone="gray">Giá khảo sát</Pill> : <Pill tone="green">Quản trị viên nhập</Pill>}</td>
                      {isAdmin ? (
                        <td>
                          <div className="cell-actions">
                            <button className="btn btn-secondary btn-sm" type="button" onClick={() => setHistory(r)}>
                              <Icon name="clock" size={14} />
                              Lịch sử
                            </button>
                            <button className="btn btn-secondary btn-sm" type="button" onClick={() => setPricing(r)}>
                              Cập nhật giá
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager {...paged} onPage={paged.setPage} noun="loại phân" />
          </>
        )}
      </Panel>

      {pricing && prices ? (
        <PriceForm
          prices={prices}
          fixed={pricing === "new" ? null : pricing}
          onClose={() => setPricing(null)}
          onSaved={async message => {
            setPricing(null);
            setNote(message);
            await load();
          }}
        />
      ) : null}
      {history ? <HistoryDialog row={history} onClose={() => setHistory(null)} /> : null}
    </>
  );
}

function PriceForm({
  prices,
  fixed,
  onClose,
  onSaved,
}: {
  prices: FertilizerPriceRow[];
  fixed: FertilizerPriceRow | null;
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
}) {
  const [fertilizerId, setFertilizerId] = useState(fixed?.fertilizer_id ?? "");
  const [price, setPrice] = useState(fixed ? String(fixed.price_per_kg) : "");
  const [effective, setEffective] = useState(todayInput());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const priceNumber = Number(price);
    if (!fertilizerId) return setError("Chọn loại phân bón.");
    if (!Number.isFinite(priceNumber) || priceNumber <= 0) return setError("Giá phải là số dương.");
    if (!effective) return setError("Chọn ngày có hiệu lực.");
    setBusy(true);
    setError(null);
    try {
      await api<FertilizerPriceRow>("/fertilizer-prices", {
        method: "POST",
        body: JSON.stringify({
          fertilizer_id: fertilizerId,
          price_per_kg: priceNumber,
          // 00:00 giờ Việt Nam của ngày đã chọn.
          effective_from: new Date(`${effective}T00:00:00+07:00`).getTime(),
        }),
      });
      await onSaved(`Đã lưu giá mới cho ${prices.find(p => p.fertilizer_id === fertilizerId)?.fertilizer_name ?? fertilizerId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không lưu được giá");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={fixed ? `Cập nhật giá — ${fixed.fertilizer_name}` : "Nhập giá phân bón mới"}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" type="button" onClick={onClose}>
            Huỷ
          </button>
          <button className="btn btn-primary" type="submit" form="price-form" disabled={busy}>
            {busy ? "Đang lưu…" : "Lưu giá"}
          </button>
        </>
      }
    >
      <form id="price-form" onSubmit={submit}>
        <Field label="Loại phân bón" htmlFor="price-fertilizer">
          <select id="price-fertilizer" value={fertilizerId} onChange={e => setFertilizerId(e.target.value)} disabled={fixed !== null} required>
            <option value="">— Chọn loại phân bón —</option>
            {[...prices]
              .sort((a, b) => a.fertilizer_name.localeCompare(b.fertilizer_name, "vi"))
              .map(p => (
                <option key={p.fertilizer_id} value={p.fertilizer_id}>
                  {p.fertilizer_name}
                </option>
              ))}
          </select>
        </Field>
        <div className="form-grid-2">
          <Field label="Giá (đồng/kg)" htmlFor="price-value">
            <input id="price-value" type="number" min={1} step={100} value={price} onChange={e => setPrice(e.target.value)} placeholder="ví dụ: 14500" required />
          </Field>
          <Field label="Có hiệu lực từ ngày" htmlFor="price-date" hint="Ngày giá bắt đầu có hiệu lực. Các mốc giá cũ vẫn nằm trong lịch sử.">
            <input id="price-date" type="date" value={effective} onChange={e => setEffective(e.target.value)} required />
          </Field>
        </div>
        <p className="field-hint" style={{marginTop: 12}}>
          Giá mới được ghi thành một dòng mới; lịch sử giá cũ được giữ nguyên để phân tích chi phí theo thời gian.
        </p>
        {error ? (
          <div style={{marginTop: 16}}>
            <Notice>{error}</Notice>
          </div>
        ) : null}
      </form>
    </Modal>
  );
}

function HistoryDialog({row, onClose}: {row: FertilizerPriceRow; onClose: () => void}) {
  const [rows, setRows] = useState<FertilizerPriceRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<FertilizerPriceRow[]>(`/fertilizer-prices/history/${row.fertilizer_id}`)
      .then(r => !cancelled && setRows(r))
      .catch(() => !cancelled && setRows([]));
    return () => {
      cancelled = true;
    };
  }, [row.fertilizer_id]);

  return (
    <Modal title={`Lịch sử giá — ${row.fertilizer_name}`} onClose={onClose} footer={<button className="btn btn-secondary" type="button" onClick={onClose}>Đóng</button>}>
      {rows === null ? (
        <TableSkeleton rows={3} cols={3} />
      ) : rows.length === 0 ? (
        <EmptyState icon="clock" title="Chưa có lần cập nhật nào" hint="Loại phân này đang dùng giá khảo sát trong danh mục." />
      ) : (
        <div className="data-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Hiệu lực từ</th>
                <th className="num">Giá (đồng/kg)</th>
                <th>Nhập lúc</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((h, i) => (
                <tr key={h.id}>
                  <td className="nowrap">
                    {formatDate(h.effective_from)} {i === 0 ? <Pill tone="green">Mới nhất</Pill> : null}
                  </td>
                  <td className="num">{formatVnd(h.price_per_kg)}</td>
                  <td className="nowrap">{formatDate(h.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
