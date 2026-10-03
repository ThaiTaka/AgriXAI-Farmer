"use client";

/**
 * Lô đất — land is surveyed, coded and handed to a farm here; the phone only
 * shows the plots it has been given (a farmer cannot create one). The admin
 * can also correct a plot's details; the farmer keeps editing what is planted
 * from the phone, and both edits meet through the sync.
 *
 * A plot stays with the farm it was given to: moving it to another farm would
 * leave it on the first farm's phone, which never learns it moved. To hand a
 * piece of land to someone else, create a new plot for them and delete this one.
 */

import {FormEvent, useEffect, useMemo, useState} from "react";

import {useAdmin} from "@/components/AdminShell";
import {IconEdit, IconPlots, IconPlus, IconSearch, IconTrash} from "@/components/icons";
import {EmptyState, Modal, PageHeader, Panel, Pill, Segmented, Skeleton, StatCard, Toast} from "@/components/ui";
import {api} from "@/lib/api";
import {formatArea, formatNumber, timeAgo} from "@/lib/format";
import type {PlotRow} from "@/lib/types";

interface Variety {
  id: string;
  name: string;
  crop_type: string;
  crop_name: string;
  category_name: string | null;
  is_seed: boolean;
  approved: boolean;
}

/** Same table as mobile/src/domain/areaUnits.ts. */
const AREA_UNITS = [
  {code: "m2", label: "m²", m2: 1},
  {code: "sao_lam_dong", label: "sào Lâm Đồng (1.000 m²)", m2: 1000},
  {code: "ha", label: "ha", m2: 10000},
];
const LEGACY_UNITS: Record<string, number> = {sao_bac: 360, sao_trung: 500, cong_nam: 1000, mau_bac: 3600};
const unitM2 = (code: string) => AREA_UNITS.find(u => u.code === code)?.m2 ?? LEGACY_UNITS[code] ?? 1;
const unitShort = (code: string) => (code === "m2" ? "m²" : code === "ha" ? "ha" : code === "sao_lam_dong" ? "sào" : code);

const STATUS: Record<string, {label: string; tone: "green" | "amber" | "gray"}> = {
  active: {label: "Đang canh tác", tone: "green"},
  fallow: {label: "Bỏ hoá", tone: "amber"},
  harvested: {label: "Đã thu hoạch", tone: "gray"},
};

type StatusFilter = "all" | "active" | "fallow" | "harvested";

interface Draft {
  code: string;
  name: string;
  owner_id: string;
  region: string;
  area: string;
  area_unit: string;
  crop_type: string;
  variety_id: string;
  planted_at: string;
  status: string;
  notes: string;
}

const EMPTY: Draft = {
  code: "",
  name: "",
  owner_id: "",
  region: "Làng hoa Vạn Thành, Đà Lạt, Lâm Đồng",
  area: "",
  area_unit: "m2",
  crop_type: "",
  variety_id: "",
  planted_at: "",
  status: "active",
  notes: "",
};

const toDateInput = (ms: number | null) => {
  if (!ms) return "";
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function PlotsPage() {
  const {farms} = useAdmin();
  const [plots, setPlots] = useState<PlotRow[] | null>(null);
  const [varieties, setVarieties] = useState<Variety[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [farmFilter, setFarmFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [editing, setEditing] = useState<{id: string | null; draft: Draft} | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = () =>
    api<PlotRow[]>("/plots")
      .then(setPlots)
      .catch(e => setError(e instanceof Error ? e.message : String(e)));

  useEffect(() => {
    load();
    api<Variety[]>("/crop-varieties")
      .then(rows => setVarieties(rows.filter(v => v.is_seed || v.approved)))
      .catch(() => setVarieties([]));
  }, []);

  const farmName = useMemo(() => {
    const map = new Map(farms.map(f => [f.id, f.full_name || f.username]));
    return (id: string) => map.get(id) ?? "Quản trị viên";
  }, [farms]);

  const crops = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of varieties) if (!map.has(v.crop_type)) map.set(v.crop_type, v.crop_name);
    return [...map.entries()].map(([id, name]) => ({id, name})).sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }, [varieties]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (plots ?? []).filter(p => {
      if (farmFilter !== "all" && p.owner_id !== farmFilter) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!q) return true;
      return [p.code, p.name, p.crop_name ?? "", p.variety_name ?? "", farmName(p.owner_id)].some(s => s.toLowerCase().includes(q));
    });
  }, [plots, query, farmFilter, statusFilter, farmName]);

  const totals = useMemo(() => {
    const list = plots ?? [];
    const area = list.reduce((s, p) => s + p.area * unitM2(p.area_unit), 0);
    return {count: list.length, area, active: list.filter(p => p.status === "active").length, farms: new Set(list.map(p => p.owner_id)).size};
  }, [plots]);

  const openCreate = () => {
    setFormError(null);
    setEditing({id: null, draft: {...EMPTY, owner_id: farms[0]?.id ?? "", crop_type: crops[0]?.id ?? ""}});
  };

  const openEdit = (p: PlotRow) => {
    setFormError(null);
    setEditing({
      id: p.id,
      draft: {
        code: p.code,
        name: p.name,
        owner_id: p.owner_id,
        region: p.region ?? "",
        area: String(p.area),
        area_unit: p.area_unit,
        crop_type: p.crop_type,
        variety_id: p.variety_id ?? "",
        planted_at: toDateInput(p.planted_at),
        status: p.status,
        notes: p.notes ?? "",
      },
    });
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const d = editing.draft;
    const area = Number(d.area.replace(",", "."));
    if (!d.code.trim() || !d.name.trim()) return setFormError("Cần mã lô và tên lô.");
    if (!Number.isFinite(area) || area <= 0) return setFormError("Diện tích phải là số lớn hơn 0.");
    if (!d.crop_type) return setFormError("Chọn cây trồng.");
    const variety = varieties.find(v => v.id === d.variety_id);
    const body = {
      code: d.code.trim(),
      name: d.name.trim(),
      region: d.region.trim() || null,
      area,
      area_unit: d.area_unit,
      crop_type: d.crop_type,
      crop_name: crops.find(c => c.id === d.crop_type)?.name ?? null,
      variety_id: variety?.id ?? null,
      variety_name: variety?.name ?? null,
      planted_at: d.planted_at ? new Date(`${d.planted_at}T07:00:00`).getTime() : null,
      status: d.status,
      notes: d.notes.trim() || null,
    };
    setSaving(true);
    setFormError(null);
    try {
      if (editing.id) {
        await api(`/plots/${editing.id}`, {method: "PATCH", body: JSON.stringify(body)});
        setToast("Đã lưu lô đất — nông hộ thấy ngay ở lần đồng bộ tới");
      } else {
        if (!d.owner_id) throw new Error("Chọn nông hộ nhận lô.");
        await api("/plots", {method: "POST", body: JSON.stringify({...body, owner_id: d.owner_id})});
        setToast(`Đã giao lô ${body.code} cho ${farmName(d.owner_id)}`);
      }
      setEditing(null);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p: PlotRow) => {
    if (!window.confirm(`Xoá lô ${p.code} — ${p.name} của ${farmName(p.owner_id)}? Lô biến mất khỏi điện thoại của hộ ở lần đồng bộ tới.`)) return;
    try {
      await api(`/plots/${p.id}`, {method: "DELETE"});
      setToast(`Đã xoá lô ${p.code}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const set = (patch: Partial<Draft>) => setEditing(cur => (cur ? {...cur, draft: {...cur.draft, ...patch}} : cur));
  const draft = editing?.draft;
  const cropVarieties = varieties.filter(v => v.crop_type === draft?.crop_type);

  return (
    <main className="page">
      <PageHeader
        title="Lô đất"
        subtitle="Đo, đặt mã và giao lô cho nông hộ. Điện thoại của hộ nhận lô ở lần đồng bộ tới; nông dân không tự tạo lô."
        actions={
          <button className="btn btn-primary" onClick={openCreate} disabled={farms.length === 0}>
            <IconPlus size={18} /> Giao lô mới
          </button>
        }
      />

      {error ? <p className="error">{error}</p> : null}

      <div className="grid grid-kpi">
        <StatCard label="Tổng số lô" tone="green" icon={<IconPlots size={22} />} value={plots ? formatNumber(totals.count) : <Skeleton height={28} width={50} />} sub={`${totals.active} đang canh tác`} />
        <StatCard label="Tổng diện tích" tone="lime" icon={<IconPlots size={22} />} value={plots ? formatArea(totals.area) : <Skeleton height={28} width={90} />} sub="Quy về m² theo đơn vị của từng lô" />
        <StatCard label="Nông hộ có lô" tone="blue" icon={<IconPlots size={22} />} value={plots ? `${totals.farms}/${farms.length}` : <Skeleton height={28} width={50} />} sub="Hộ chưa có lô chưa dùng được sổ theo lô" />
        <StatCard label="Cây trồng trong danh mục" tone="amber" icon={<IconPlots size={22} />} value={formatNumber(crops.length)} sub="Theo danh mục giống Lâm Đồng" />
      </div>

      <Panel
        title="Danh sách lô"
        subtitle={plots ? `${visible.length} / ${plots.length} lô` : undefined}
        action={
          <div className="toolbar">
            <label className="search">
              <IconSearch size={18} />
              <input className="input" placeholder="Tìm mã, tên lô, cây, hộ…" value={query} onChange={e => setQuery(e.target.value)} aria-label="Tìm lô" />
            </label>
            <select className="input" value={farmFilter} onChange={e => setFarmFilter(e.target.value)} aria-label="Lọc theo nông hộ">
              <option value="all">Mọi nông hộ</option>
              {farms.map(f => (
                <option key={f.id} value={f.id}>
                  {f.full_name || f.username}
                </option>
              ))}
            </select>
            <Segmented<StatusFilter>
              label="Trạng thái"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                {value: "all", label: "Tất cả"},
                {value: "active", label: "Canh tác"},
                {value: "fallow", label: "Bỏ hoá"},
                {value: "harvested", label: "Đã thu"},
              ]}
            />
          </div>
        }
        flush>
        {plots == null ? (
          <div className="panel-body">
            <Skeleton height={180} />
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<IconPlots />}
            title={plots.length === 0 ? "Chưa có lô đất nào" : "Không có lô khớp bộ lọc"}
            body={plots.length === 0 ? "Giao lô đầu tiên cho một nông hộ để họ bắt đầu ghi sổ theo lô." : "Thử bỏ bớt điều kiện lọc."}
            action={
              plots.length === 0 ? (
                <button className="btn btn-primary" onClick={openCreate}>
                  <IconPlus size={18} /> Giao lô mới
                </button>
              ) : null
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Lô</th>
                  <th>Nông hộ</th>
                  <th>Cây trồng · giống</th>
                  <th className="num">Diện tích</th>
                  <th>Ngày trồng</th>
                  <th>Trạng thái</th>
                  <th>Cập nhật</th>
                  <th aria-label="Thao tác" />
                </tr>
              </thead>
              <tbody>
                {visible.map(p => {
                  const st = STATUS[p.status] ?? {label: p.status, tone: "gray" as const};
                  const m2 = p.area * unitM2(p.area_unit);
                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="cell-main">{p.code}</div>
                        <div className="cell-sub">{p.name}</div>
                      </td>
                      <td>{farmName(p.owner_id)}</td>
                      <td>
                        <div className="cell-main">{p.crop_name ?? p.crop_type}</div>
                        <div className="cell-sub">{p.variety_name ?? "Chưa chọn giống"}</div>
                      </td>
                      <td className="num">
                        <div className="cell-main">
                          {p.area.toLocaleString("vi-VN")} {unitShort(p.area_unit)}
                        </div>
                        {p.area_unit !== "m2" ? <div className="cell-sub">{formatArea(m2)}</div> : null}
                      </td>
                      <td>{p.planted_at ? new Date(p.planted_at).toLocaleDateString("vi-VN") : <span className="text-muted">—</span>}</td>
                      <td>
                        <Pill tone={st.tone}>{st.label}</Pill>
                      </td>
                      <td className="text-muted">{timeAgo(p.updated_at)}</td>
                      <td>
                        <div className="row-actions">
                          <button className="btn btn-secondary btn-sm" onClick={() => openEdit(p)} aria-label={`Sửa lô ${p.code}`}>
                            <IconEdit size={16} /> Sửa
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => remove(p)} aria-label={`Xoá lô ${p.code}`}>
                            <IconTrash size={16} />
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

      {editing && draft ? (
        <Modal title={editing.id ? `Sửa lô ${draft.code}` : "Giao lô mới cho nông hộ"} onClose={() => setEditing(null)} wide>
          <form className="form" onSubmit={save}>
            <div className="form-grid">
              <label className="field">
                <span className="field-label">Mã lô</span>
                <input className="input" value={draft.code} onChange={e => set({code: e.target.value})} placeholder="VD: PUC-004-VT" maxLength={32} required />
              </label>
              <label className="field">
                <span className="field-label">Tên lô</span>
                <input className="input" value={draft.name} onChange={e => set({name: e.target.value})} placeholder="VD: Nhà màng hoa cúc số 2" maxLength={128} required />
              </label>
              <label className="field">
                <span className="field-label">Nông hộ nhận lô</span>
                <select className="input" value={draft.owner_id} onChange={e => set({owner_id: e.target.value})} disabled={editing.id != null}>
                  {farms.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.full_name || f.username} ({f.username})
                    </option>
                  ))}
                </select>
                {editing.id != null ? <span className="field-hint">Lô đã giao không chuyển sang hộ khác được — tạo lô mới cho hộ đó.</span> : null}
              </label>
              <label className="field">
                <span className="field-label">Khu vực</span>
                <input className="input" value={draft.region} onChange={e => set({region: e.target.value})} maxLength={160} />
              </label>
              <div className="field">
                <span className="field-label">Diện tích</span>
                <div className="row">
                  <input className="input" inputMode="decimal" value={draft.area} onChange={e => set({area: e.target.value})} placeholder="VD: 500" aria-label="Diện tích" style={{flex: 1}} />
                  <select className="input" value={draft.area_unit} onChange={e => set({area_unit: e.target.value})} aria-label="Đơn vị" style={{width: 190}}>
                    {AREA_UNITS.map(u => (
                      <option key={u.code} value={u.code}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </div>
                {draft.area && draft.area_unit !== "m2" ? (
                  <span className="field-hint">= {formatArea(Number(draft.area.replace(",", ".")) * unitM2(draft.area_unit) || 0)}</span>
                ) : null}
              </div>
              <label className="field">
                <span className="field-label">Trạng thái</span>
                <select className="input" value={draft.status} onChange={e => set({status: e.target.value})}>
                  {Object.entries(STATUS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field-label">Cây trồng</span>
                <select className="input" value={draft.crop_type} onChange={e => set({crop_type: e.target.value, variety_id: ""})}>
                  {crops.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field-label">Giống (không bắt buộc)</span>
                <select className="input" value={draft.variety_id} onChange={e => set({variety_id: e.target.value})}>
                  <option value="">Chưa chọn giống</option>
                  {cropVarieties.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.category_name ? `${v.category_name} · ` : ""}
                      {v.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field-label">Ngày trồng</span>
                <input className="input" type="date" value={draft.planted_at} onChange={e => set({planted_at: e.target.value})} />
                <span className="field-hint">Ứng dụng dùng ngày này để biết lô đang ở giai đoạn chăm sóc nào.</span>
              </label>
              <label className="field">
                <span className="field-label">Ghi chú</span>
                <input className="input" value={draft.notes} onChange={e => set({notes: e.target.value})} />
              </label>
            </div>
            {formError ? <p className="error">{formError}</p> : null}
            <div className="form-actions">
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? "Đang lưu…" : editing.id ? "Lưu thay đổi" : "Giao lô"}
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => setEditing(null)}>
                Huỷ
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {toast ? <Toast message={toast} onDone={() => setToast(null)} /> : null}
    </main>
  );
}
