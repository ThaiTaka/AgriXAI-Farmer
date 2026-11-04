"use client";

/**
 * Lô đất — nơi quản trị viên khảo sát, lập mã và GIAO lô cho nông hộ.
 *
 * Đây là nửa còn lại của quy tắc "nông hộ không tự tạo lô": ứng dụng điện thoại
 * không có nút thêm lô, backend từ chối `POST /plots` của nông hộ (403) và từ chối
 * cả lô mới gửi qua /sync. Lô chỉ ra đời từ trang này.
 *
 * Mã lô có dạng PUC-YYMM-XXXX (năm, tháng lập lô và 4 ký tự) — cùng khuôn với
 * kiểm tra trong ứng dụng điện thoại (mobile/src/utils/plotCode.ts).
 */

import {useSearchParams} from "next/navigation";
import {FormEvent, Suspense, useCallback, useEffect, useMemo, useState} from "react";

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
  useConfirm,
  usePaged,
} from "@/components/admin/ui";
import {api, ApiError, formatDate} from "@/lib/api";
import {PLOT_CODE_PATTERN, PLOT_STATUS, cropLabel, fold, formatArea, plotAreaM2, suggestPlotCode} from "@/lib/format";

interface PlotRow {
  id: string;
  code: string;
  name: string;
  region: string | null;
  area: number;
  area_unit: string;
  crop_type: string;
  crop_name: string | null;
  variety_id: string | null;
  variety_name: string | null;
  planted_at: number | null;
  status: string;
  notes: string | null;
  owner_id: string;
  updated_at: number;
}

interface UserRow {
  id: string;
  username: string;
  full_name: string;
  region: string | null;
  role: string;
  is_active: boolean;
}

interface Variety {
  id: string;
  name: string;
  crop_type: string;
  crop_name: string;
  approved: boolean;
}

export default function PlotsPage() {
  // useSearchParams cần ranh giới Suspense khi trang được dựng sẵn lúc build.
  return (
    <Suspense fallback={<TableSkeleton rows={6} cols={5} />}>
      <PlotsInner />
    </Suspense>
  );
}

function PlotsInner() {
  const {isAdmin} = useAdmin();
  const params = useSearchParams();
  const initialOwner = params.get("owner") ?? "all";
  const [plots, setPlots] = useState<PlotRow[] | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [varieties, setVarieties] = useState<Variety[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [owner, setOwner] = useState(initialOwner);
  const [crop, setCrop] = useState("all");
  const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState<PlotRow | "new" | null>(params.get("new") ? "new" : null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const {confirm, dialog} = useConfirm();

  const load = useCallback(async () => {
    try {
      const [p, u, v] = await Promise.all([api<PlotRow[]>("/plots"), api<UserRow[]>("/users"), api<Variety[]>("/crop-varieties")]);
      setPlots(p);
      setUsers(u.filter(x => x.role === "farmer"));
      setVarieties(v);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    // `load` chỉ setState sau khi yêu cầu mạng trả về.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isAdmin) void load();
  }, [isAdmin, load]);

  const farmerById = useMemo(() => new Map(users.map(u => [u.id, u])), [users]);

  const cropOptions = useMemo(() => {
    const seen = new Map<string, string>();
    (plots ?? []).forEach(p => seen.set(p.crop_type, cropLabel(p.crop_type, p.crop_name)));
    return [{value: "all", label: "Tất cả cây trồng"}, ...[...seen].map(([value, label]) => ({value, label})).sort((a, b) => a.label.localeCompare(b.label, "vi"))];
  }, [plots]);

  const filtered = useMemo(() => {
    const q = fold(query.trim());
    return (plots ?? [])
      .filter(p => (owner === "all" ? true : p.owner_id === owner))
      .filter(p => (crop === "all" ? true : p.crop_type === crop))
      .filter(p => (status === "all" ? true : p.status === status))
      .filter(p => {
        if (!q) return true;
        const farmer = farmerById.get(p.owner_id);
        return fold(`${p.code} ${p.name} ${p.region ?? ""} ${farmer?.full_name ?? ""} ${p.variety_name ?? ""}`).includes(q);
      })
      .sort((a, b) => b.code.localeCompare(a.code));
  }, [plots, owner, crop, status, query, farmerById]);

  const paged = usePaged(filtered, 10);
  const totalArea = filtered.reduce((s, p) => s + plotAreaM2(p.area, p.area_unit), 0);

  const remove = async (plot: PlotRow) => {
    const ok = await confirm({
      title: "Xoá lô đất",
      message: `Xoá lô ${plot.code} — “${plot.name}”? Lô sẽ biến mất khỏi điện thoại của nông hộ ở lần đồng bộ tới. Nhật ký, kho và thu – chi gắn với lô vẫn được giữ.`,
      confirmLabel: "Xoá lô",
      danger: true,
    });
    if (!ok) return;
    setBusyId(plot.id);
    try {
      await api<void>(`/plots/${plot.id}`, {method: "DELETE"});
      setNote(`Đã xoá lô ${plot.code}`);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Không xoá được lô đất");
    } finally {
      setBusyId(null);
    }
  };

  if (!isAdmin) return <Notice>Trang này chỉ dành cho quản trị viên.</Notice>;

  return (
    <>
      <PageHeader
        title="Lô đất"
        subtitle={plots ? `${filtered.length} / ${plots.length} lô · tổng diện tích ${formatArea(totalArea)}` : "Đang tải…"}
        actions={
          <button className="btn btn-primary" type="button" onClick={() => setEditing("new")}>
            <Icon name="plus" size={16} />
            Giao lô mới
          </button>
        }
      />
      {error ? <Notice>{error}</Notice> : null}
      {note ? <Notice tone="green">{note}</Notice> : null}

      <Panel flush>
        <div className="toolbar">
          <SearchBox value={query} onChange={setQuery} placeholder="Tìm theo mã lô, tên lô, nông hộ, giống…" label="Tìm lô đất" />
          <FilterSelect
            label="Nông hộ"
            value={owner}
            onChange={setOwner}
            options={[{value: "all", label: "Tất cả nông hộ"}, ...users.map(u => ({value: u.id, label: u.full_name}))]}
          />
          <FilterSelect label="Cây trồng" value={crop} onChange={setCrop} options={cropOptions} />
          <FilterSelect
            label="Trạng thái"
            value={status}
            onChange={setStatus}
            options={[
              {value: "all", label: "Tất cả"},
              ...Object.entries(PLOT_STATUS).map(([value, s]) => ({value, label: s.label})),
            ]}
          />
        </div>

        {plots === null && !error ? (
          <TableSkeleton rows={8} cols={5} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="plots"
            title={plots && plots.length === 0 ? "Chưa có lô đất nào" : "Không có lô nào khớp bộ lọc"}
            hint={plots && plots.length === 0 ? "Khảo sát, lập mã rồi giao lô cho nông hộ để họ bắt đầu ghi chép." : undefined}
            action={
              <button className="btn btn-primary" type="button" onClick={() => setEditing("new")}>
                Giao lô mới
              </button>
            }
          />
        ) : (
          <>
            <div className="data-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Lô</th>
                    <th>Nông hộ</th>
                    <th>Cây / giống</th>
                    <th className="num">Diện tích</th>
                    <th>Xuống giống</th>
                    <th>Trạng thái</th>
                    <th aria-label="Thao tác" />
                  </tr>
                </thead>
                <tbody>
                  {paged.slice.map(p => {
                    const farmer = farmerById.get(p.owner_id);
                    const st = PLOT_STATUS[p.status] ?? {label: p.status, tone: "gray" as const};
                    return (
                      <tr key={p.id}>
                        <td>
                          <span className="cell-main">{p.name}</span>
                          <span className="cell-sub mono">{p.code}</span>
                        </td>
                        <td>
                          <span className="cell-main">{farmer?.full_name ?? "—"}</span>
                          <span className="cell-sub">{p.region?.split(",").slice(0, 2).join(",") ?? "—"}</span>
                        </td>
                        <td>
                          <span className="cell-main">{cropLabel(p.crop_type, p.crop_name)}</span>
                          {p.variety_name ? <span className="cell-sub">{p.variety_name}</span> : null}
                        </td>
                        <td className="num">{formatArea(plotAreaM2(p.area, p.area_unit))}</td>
                        <td className="nowrap">{formatDate(p.planted_at)}</td>
                        <td>
                          <Pill tone={st.tone}>{st.label}</Pill>
                        </td>
                        <td>
                          <div className="cell-actions">
                            <button type="button" className="icon-btn" onClick={() => setEditing(p)} aria-label={`Sửa lô ${p.code}`} title="Sửa">
                              <Icon name="edit" size={16} />
                            </button>
                            <button
                              type="button"
                              className="icon-btn icon-btn-danger"
                              onClick={() => remove(p)}
                              disabled={busyId === p.id}
                              aria-label={`Xoá lô ${p.code}`}
                              title="Xoá"
                            >
                              <Icon name="trash" size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pager {...paged} onPage={paged.setPage} noun="lô" />
          </>
        )}
      </Panel>

      {editing ? (
        <PlotForm
          plot={editing === "new" ? null : editing}
          farmers={users.filter(u => u.is_active || (editing !== "new" && editing.owner_id === u.id))}
          varieties={varieties}
          existingCodes={(plots ?? []).map(p => p.code)}
          defaultOwner={owner !== "all" ? owner : undefined}
          onClose={() => setEditing(null)}
          onSaved={async message => {
            setEditing(null);
            setNote(message);
            await load();
          }}
        />
      ) : null}
      {dialog}
    </>
  );
}

/** Mã đề xuất: tháng hiện tại + hậu tố ngẫu nhiên 4 ký tự chưa trùng lô nào. */
function proposeCode(existing: string[]): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 20; attempt++) {
    const suffix = Array.from({length: 4}, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
    const code = suggestPlotCode(new Date(), suffix);
    if (!existing.includes(code)) return code;
  }
  return suggestPlotCode(new Date(), "0001");
}

const dateValue = (ms: number | null) => (ms ? new Date(ms).toLocaleDateString("sv-SE", {timeZone: "Asia/Ho_Chi_Minh"}) : "");

function PlotForm({
  plot,
  farmers,
  varieties,
  existingCodes,
  defaultOwner,
  onClose,
  onSaved,
}: {
  plot: PlotRow | null;
  farmers: UserRow[];
  varieties: Variety[];
  existingCodes: string[];
  defaultOwner?: string;
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
}) {
  const creating = plot === null;
  const [ownerId, setOwnerId] = useState(plot?.owner_id ?? defaultOwner ?? farmers[0]?.id ?? "");
  const [code, setCode] = useState(plot?.code ?? proposeCode(existingCodes));
  const [name, setName] = useState(plot?.name ?? "");
  const [area, setArea] = useState(plot ? String(plot.area) : "");
  const [unit, setUnit] = useState(plot?.area_unit ?? "m2");
  const [cropType, setCropType] = useState(plot?.crop_type ?? "");
  const [varietyId, setVarietyId] = useState(plot?.variety_id ?? "");
  const [planted, setPlanted] = useState(() => dateValue(plot?.planted_at ?? Date.now()));
  const [status, setStatus] = useState(plot?.status ?? "active");
  const [region, setRegion] = useState(plot?.region ?? farmers.find(f => f.id === (plot?.owner_id ?? defaultOwner ?? farmers[0]?.id))?.region ?? "");
  const [notes, setNotes] = useState(plot?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const crops = useMemo(() => {
    const seen = new Map<string, string>();
    varieties.forEach(v => seen.set(v.crop_type, v.crop_name));
    return [...seen].map(([value, label]) => ({value, label})).sort((a, b) => a.label.localeCompare(b.label, "vi"));
  }, [varieties]);
  const choices = useMemo(() => varieties.filter(v => v.crop_type === cropType && v.approved), [varieties, cropType]);

  const codeUnchanged = plot !== null && code === plot.code;
  const codeProblem =
    !code.trim() ? "Nhập mã lô."
    : !codeUnchanged && !PLOT_CODE_PATTERN.test(code.trim().toUpperCase()) ? "Mã phải có dạng PUC-YYMM-XXXX (4 chữ số, rồi 4 chữ hoặc số in hoa)."
    : !codeUnchanged && existingCodes.includes(code.trim().toUpperCase()) ? "Mã này đã dùng cho một lô khác."
    : null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (codeProblem) {
      setError(codeProblem);
      return;
    }
    const areaNumber = Number(area.replace(",", "."));
    if (!Number.isFinite(areaNumber) || areaNumber <= 0) {
      setError("Diện tích phải là số lớn hơn 0.");
      return;
    }
    if (!cropType) {
      setError("Chọn cây trồng cho lô.");
      return;
    }
    const variety = varieties.find(v => v.id === varietyId);
    const body = {
      code: code.trim().toUpperCase(),
      name: name.trim(),
      region: region.trim() || null,
      area: areaNumber,
      area_unit: unit,
      crop_type: cropType,
      crop_name: crops.find(c => c.value === cropType)?.label ?? null,
      variety_id: variety?.id ?? null,
      variety_name: variety?.name ?? null,
      planted_at: planted ? new Date(`${planted}T08:00:00+07:00`).getTime() : null,
      status,
      notes: notes.trim() || null,
    };
    setBusy(true);
    setError(null);
    try {
      if (creating) {
        if (!ownerId) throw new ApiError("Chọn nông hộ nhận lô.", 0);
        await api("/plots", {method: "POST", body: JSON.stringify({...body, owner_id: ownerId})});
        await onSaved(`Đã giao lô ${body.code} cho ${farmers.find(f => f.id === ownerId)?.full_name ?? "nông hộ"}`);
      } else {
        await api(`/plots/${plot.id}`, {method: "PATCH", body: JSON.stringify(body)});
        await onSaved(`Đã lưu lô ${body.code}`);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Không lưu được lô đất");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      wide
      title={creating ? "Giao lô mới cho nông hộ" : `Sửa lô ${plot.code}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" type="button" onClick={onClose}>
            Huỷ
          </button>
          <button className="btn btn-primary" type="submit" form="plot-form" disabled={busy}>
            {busy ? "Đang lưu…" : creating ? "Giao lô" : "Lưu thay đổi"}
          </button>
        </>
      }
    >
      <form id="plot-form" onSubmit={submit}>
        <div className="form-grid-2">
          <Field label="Nông hộ nhận lô" htmlFor="plot-owner" hint={creating ? "Chỉ hiện tài khoản đang hoạt động." : "Không đổi chủ lô sau khi đã giao."}>
            <select
              id="plot-owner"
              value={ownerId}
              disabled={!creating}
              onChange={e => {
                setOwnerId(e.target.value);
                setRegion(farmers.find(f => f.id === e.target.value)?.region ?? "");
              }}
              required
            >
              {farmers.map(f => (
                <option key={f.id} value={f.id}>
                  {f.full_name} ({f.username})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Mã lô" htmlFor="plot-code" hint={codeProblem ?? "Dạng PUC-YYMM-XXXX, ví dụ PUC-2611-XT05."}>
            <input id="plot-code" value={code} onChange={e => setCode(e.target.value.toUpperCase())} className="mono" required />
          </Field>
        </div>
        <Field label="Tên lô" htmlFor="plot-name">
          <input id="plot-name" value={name} onChange={e => setName(e.target.value)} placeholder="Ví dụ: Ruộng cà chua Trại Mát" required maxLength={128} />
        </Field>
        <div className="form-grid-2">
          <Field label="Diện tích" htmlFor="plot-area">
            <input id="plot-area" inputMode="decimal" value={area} onChange={e => setArea(e.target.value)} required />
          </Field>
          <Field label="Đơn vị" htmlFor="plot-unit">
            <select id="plot-unit" value={unit} onChange={e => setUnit(e.target.value)}>
              <option value="m2">mét vuông (m²)</option>
              <option value="ha">héc-ta (ha)</option>
            </select>
          </Field>
        </div>
        <div className="form-grid-2">
          <Field label="Cây trồng" htmlFor="plot-crop">
            <select
              id="plot-crop"
              value={cropType}
              onChange={e => {
                setCropType(e.target.value);
                setVarietyId("");
              }}
              required
            >
              <option value="">— Chọn cây trồng —</option>
              {crops.map(c => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Giống" htmlFor="plot-variety" hint="Không bắt buộc. Chỉ liệt kê giống đã duyệt.">
            <select id="plot-variety" value={varietyId} onChange={e => setVarietyId(e.target.value)} disabled={!cropType}>
              <option value="">— Chưa chọn giống —</option>
              {choices.map(v => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="form-grid-2">
          <Field label="Ngày xuống giống" htmlFor="plot-planted">
            <input id="plot-planted" type="date" value={planted} onChange={e => setPlanted(e.target.value)} />
          </Field>
          <Field label="Trạng thái" htmlFor="plot-status">
            <select id="plot-status" value={status} onChange={e => setStatus(e.target.value)}>
              {Object.entries(PLOT_STATUS).map(([value, s]) => (
                <option key={value} value={value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Địa chỉ lô" htmlFor="plot-region">
          <input id="plot-region" value={region} onChange={e => setRegion(e.target.value)} placeholder="Thôn/khu, phường hoặc xã, tỉnh" maxLength={160} />
        </Field>
        <Field label="Ghi chú" htmlFor="plot-notes">
          <textarea id="plot-notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Loại đất, nguồn nước, hình thức canh tác…" />
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
