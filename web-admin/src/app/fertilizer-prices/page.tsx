"use client";

/**
 * Trang Quản lý Giá Phân Bón — chỉ admin mới được nhập giá, mọi người đọc được.
 *
 * Thiết kế append-only: mỗi lần cập nhật là một dòng mới trong DB.
 * Giá hiện tại = dòng có effective_from lớn nhất theo từng loại phân.
 *
 * Endpoint:
 *   GET  /fertilizer-prices/latest  → danh sách giá hiện hành (kèm fallback JSON)
 *   POST /fertilizer-prices         → admin nhập giá mới (201)
 *   GET  /fertilizer-prices/history/{id} → lịch sử giá 1 loại phân
 */

import Link from "next/link";
import {useRouter} from "next/navigation";
import {FormEvent, useCallback, useEffect, useState} from "react";

import {api, ApiError, formatVnd, getToken, type SessionUser} from "@/lib/api";

interface FertilizerPriceRow {
  id: number;
  fertilizer_id: string;
  fertilizer_name: string;
  group: string | null;
  price_per_kg: number;
  effective_from: number;  // epoch ms; 0 = giá từ JSON catalogue
  updated_by: string | null;
  created_at: number;
}

// HistoryRow có cùng shape với FertilizerPriceRow — dùng type alias thay interface rỗng
type HistoryRow = FertilizerPriceRow;

interface PriceForm {
  fertilizer_id: string;
  price_per_kg: string;
  effective_from: string; // ISO date string từ <input type="date">
}

const EMPTY_FORM: PriceForm = {
  fertilizer_id: "",
  price_per_kg: "",
  effective_from: new Date().toISOString().slice(0, 10),
};

function formatDate(ms: number): string {
  if (!ms) return "Catalogue JSON";
  return new Date(ms).toLocaleDateString("vi-VN");
}

export default function FertilizerPricesPage() {
  const router = useRouter();
  const [me, setMe] = useState<SessionUser | null>(null);
  const [prices, setPrices] = useState<FertilizerPriceRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // Form nhập giá mới
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<PriceForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Xem lịch sử giá của 1 loại phân
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadPrices = useCallback(async () => {
    const list = await api<FertilizerPriceRow[]>("/fertilizer-prices/latest");
    setPrices(list);
  }, []);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    api<SessionUser>("/auth/me")
      .then((user) => {
        setMe(user);
        return loadPrices();
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) router.replace("/login");
        else setError(e instanceof Error ? e.message : String(e));
      });
  }, [router, loadPrices]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const priceNum = parseFloat(form.price_per_kg);
    if (!form.fertilizer_id) { setFormError("Vui lòng chọn loại phân bón"); return; }
    if (isNaN(priceNum) || priceNum <= 0) { setFormError("Giá phải là số dương"); return; }
    if (!form.effective_from) { setFormError("Vui lòng chọn ngày hiệu lực"); return; }

    const effectiveMs = new Date(form.effective_from).getTime();
    setSubmitting(true);
    try {
      await api<FertilizerPriceRow>("/fertilizer-prices", {
        method: "POST",
        body: JSON.stringify({
          fertilizer_id: form.fertilizer_id,
          price_per_kg: priceNum,
          effective_from: effectiveMs,
        }),
      });
      setNote(`✓ Đã lưu giá mới cho ${form.fertilizer_id}`);
      setForm(EMPTY_FORM);
      setShowForm(false);
      await loadPrices();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Không lưu được giá");
    } finally {
      setSubmitting(false);
    }
  }

  async function loadHistory(fid: string) {
    if (historyId === fid) {
      setHistoryId(null);
      setHistory([]);
      return;
    }
    setHistoryLoading(true);
    setHistoryId(fid);
    try {
      const rows = await api<HistoryRow[]>(`/fertilizer-prices/history/${fid}`);
      setHistory(rows);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  const signOut = () => {
    if (typeof window !== "undefined") window.localStorage.removeItem("agrilog.token");
    router.replace("/login");
  };

  if (!me) {
    return (
      <main className="page">
        <p className="muted">Đang tải…</p>
      </main>
    );
  }

  // Nhóm giá theo category
  const grouped = prices.reduce<Record<string, FertilizerPriceRow[]>>((acc, r) => {
    const key = r.group ?? "Khác";
    (acc[key] ??= []).push(r);
    return acc;
  }, {});

  return (
    <main className="page">
      <header className="topbar">
        <div>
          <p className="eyebrow">AgriLog v2 · Quản trị</p>
          <h1 className="title">Giá Phân Bón</h1>
          <p className="muted small">Giá thị trường hiện hành · cập nhật theo ngày</p>
        </div>
        <div className="topbar-actions">
          <Link href="/dashboard" className="btn btn-secondary">← Dashboard</Link>
          <Link href="/settings" className="btn btn-secondary">Cài đặt</Link>
          <button className="btn btn-secondary" type="button" onClick={signOut}>Đăng xuất</button>
        </div>
      </header>

      {error && <p className="error" role="alert">{error}</p>}
      {note && <p className="success">{note}</p>}

      {/* ─── Form nhập giá mới (chỉ admin) ─── */}
      {me.role === "admin" && (
        <div className="card" style={{marginBottom: "1.5rem"}}>
          <div className="row-between">
            <h2 className="h2">Cập nhật giá mới</h2>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => { setShowForm(!showForm); setFormError(null); }}
            >
              {showForm ? "Đóng" : "+ Nhập giá"}
            </button>
          </div>

          {showForm && (
            <form onSubmit={handleSubmit} noValidate className="create-form">
              {formError && <p className="error" role="alert">{formError}</p>}
              <div className="form-grid">
                <label className="label">
                  Loại phân bón *
                  <input
                    className="input"
                    list="fertilizer-ids"
                    required
                    value={form.fertilizer_id}
                    onChange={(e) => setForm({...form, fertilizer_id: e.target.value})}
                    placeholder="Nhập hoặc chọn mã phân bón"
                  />
                  <datalist id="fertilizer-ids">
                    {prices.map((p) => (
                      <option key={p.fertilizer_id} value={p.fertilizer_id}>
                        {p.fertilizer_name}
                      </option>
                    ))}
                  </datalist>
                </label>
                <label className="label">
                  Giá VNĐ/kg *
                  <input
                    className="input"
                    type="number"
                    required
                    min={1}
                    step="100"
                    value={form.price_per_kg}
                    onChange={(e) => setForm({...form, price_per_kg: e.target.value})}
                    placeholder="VD: 14500"
                  />
                </label>
                <label className="label">
                  Ngày có hiệu lực *
                  <input
                    className="input"
                    type="date"
                    required
                    value={form.effective_from}
                    onChange={(e) => setForm({...form, effective_from: e.target.value})}
                  />
                </label>
              </div>
              <div className="form-actions">
                <button className="btn btn-primary" type="submit" disabled={submitting}>
                  {submitting ? "Đang lưu…" : "Lưu giá"}
                </button>
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => { setShowForm(false); setFormError(null); setForm(EMPTY_FORM); }}
                >
                  Huỷ
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* ─── Bảng giá hiện hành theo nhóm ─── */}
      {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([group, rows]) => (
        <section key={group} className="card" style={{marginBottom: "1.5rem"}}>
          <h2 className="h2" style={{marginBottom: "0.75rem"}}>{group}</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Tên phân bón</th>
                  <th>Mã</th>
                  <th style={{textAlign: "right"}}>Giá/kg</th>
                  <th>Hiệu lực từ</th>
                  <th>Nguồn</th>
                  {me.role === "admin" && <th>Lịch sử</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <>
                    <tr key={r.fertilizer_id}>
                      <td>{r.fertilizer_name}</td>
                      <td>
                        <code style={{fontSize: "0.75rem", color: "var(--color-text-muted)"}}>
                          {r.fertilizer_id}
                        </code>
                      </td>
                      <td style={{textAlign: "right", fontWeight: 600}}>
                        {formatVnd(r.price_per_kg)}/kg
                      </td>
                      <td>{formatDate(r.effective_from)}</td>
                      <td>
                        {r.id === -1 ? (
                          <span className="badge badge-gray">Catalogue</span>
                        ) : (
                          <span className="badge badge-green">Cập nhật DB</span>
                        )}
                      </td>
                      {me.role === "admin" && (
                        <td>
                          <button
                            className="btn-secondary-sm"
                            type="button"
                            onClick={() => loadHistory(r.fertilizer_id)}
                            disabled={historyLoading && historyId === r.fertilizer_id}
                          >
                            {historyId === r.fertilizer_id ? "Ẩn" : "Xem lịch sử"}
                          </button>
                        </td>
                      )}
                    </tr>
                    {/* Lịch sử inline khi admin nhấn "Xem lịch sử" */}
                    {historyId === r.fertilizer_id && (
                      <tr key={`${r.fertilizer_id}-history`}>
                        <td colSpan={me.role === "admin" ? 6 : 5} style={{background: "var(--color-surface-subtle)", padding: "0.75rem 1rem"}}>
                          {historyLoading ? (
                            <p className="muted small">Đang tải…</p>
                          ) : history.length === 0 ? (
                            <p className="muted small">Chưa có lịch sử trong DB (giá từ catalogue).</p>
                          ) : (
                            <table className="table" style={{margin: 0}}>
                              <thead>
                                <tr>
                                  <th>Giá/kg</th>
                                  <th>Hiệu lực từ</th>
                                  <th>Cập nhật lúc</th>
                                </tr>
                              </thead>
                              <tbody>
                                {history.map((h, i) => (
                                  <tr key={h.id} style={i === 0 ? {fontWeight: 600} : {}}>
                                    <td>{formatVnd(h.price_per_kg)}/kg</td>
                                    <td>{formatDate(h.effective_from)}</td>
                                    <td>{formatDate(h.created_at)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {prices.length === 0 && !error && (
        <div className="card">
          <p className="muted">Đang tải danh sách giá phân bón…</p>
        </div>
      )}
    </main>
  );
}
