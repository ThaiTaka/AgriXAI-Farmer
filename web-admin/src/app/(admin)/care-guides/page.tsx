"use client";

/**
 * Hướng dẫn chăm sóc (V2.1) — nơi quản trị viên soạn hướng dẫn có video
 * YouTube nhúng và ảnh từng bước cho từng loại cây.
 *
 * Hướng dẫn về điện thoại qua đồng bộ (bảng care_guides dùng chung), nên nông
 * hộ đọc được cả khi không có sóng; video và ảnh cần mạng lần đầu. Chỉ bản
 * "Đã đăng" hiện trên điện thoại — bản nháp để soạn dần.
 *
 * Ảnh tải lên ở đây là ảnh công khai (ai có đường dẫn cũng xem được) vì đó là
 * tài liệu hướng dẫn chung, không phải ảnh ruộng của một nông hộ.
 */

import {useCallback, useEffect, useMemo, useState} from "react";

import {Icon} from "@/components/admin/Icon";
import {useAdmin} from "@/components/admin/Shell";
import {EmptyState, FilterSelect, Notice, PageHeader, Pager, Panel, Pill, SearchBox, TableSkeleton, useConfirm, usePaged} from "@/components/admin/ui";
import {api, ApiError, apiUpload, mediaUrl} from "@/lib/api";
import {fold} from "@/lib/format";

interface Step {
  title: string;
  body: string;
  image_id: string | null;
}

interface Guide {
  id: string;
  crop_type: string;
  stage_code: string | null;
  title: string;
  summary: string | null;
  youtube_id: string | null;
  steps: Step[];
  image_ids: string[];
  source_name: string | null;
  source_url: string | null;
  published: boolean;
  sort_order: number;
  updated_at: number;
}

interface Variety {
  crop_type: string;
  crop_name: string;
}

interface Draft {
  id: string | null;
  crop_type: string;
  stage_code: string;
  title: string;
  summary: string;
  youtube: string;
  steps: Step[];
  image_ids: string[];
  source_name: string;
  source_url: string;
  published: boolean;
  sort_order: number;
}

const STAGES: {code: string; label: string}[] = [
  {code: "", label: "Mọi giai đoạn"},
  {code: "seedling", label: "Cây con"},
  {code: "vegetative", label: "Sinh trưởng"},
  {code: "flowering", label: "Ra hoa"},
  {code: "fruiting", label: "Đậu quả, nuôi quả"},
  {code: "harvesting", label: "Thu hoạch"},
];

const EMPTY: Draft = {
  id: null,
  crop_type: "tomato",
  stage_code: "",
  title: "",
  summary: "",
  youtube: "",
  steps: [],
  image_ids: [],
  source_name: "",
  source_url: "",
  published: false,
  sort_order: 0,
};

/** Mirror of the server's parser, only for the live preview. */
function youtubeIdOf(value: string): string | null {
  const v = value.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(v)) return v;
  const match =
    /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/))([A-Za-z0-9_-]{11})/.exec(v);
  return match?.[1] ?? null;
}

const stageLabel = (code: string | null) => STAGES.find(s => s.code === (code ?? ""))?.label ?? code ?? "";

async function uploadPublicImage(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  form.append("public", "true");
  const body = await apiUpload<{id: string}>("/media", form);
  return body.id;
}

export default function CareGuidesPage() {
  const {isAdmin} = useAdmin();
  const [guides, setGuides] = useState<Guide[] | null>(null);
  const [query, setQuery] = useState("");
  const [cropFilter, setCropFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const {confirm, dialog} = useConfirm();
  const [crops, setCrops] = useState<{id: string; name: string}[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  const load = useCallback(() => api<Guide[]>("/care-guides").then(setGuides), []);

  useEffect(() => {
    if (!isAdmin) return;
    Promise.all([load(), api<Variety[]>("/crop-varieties")])
      .then(([, varieties]) => {
        const byId = new Map<string, string>();
        for (const v of varieties) if (!byId.has(v.crop_type)) byId.set(v.crop_type, v.crop_name);
        setCrops([...byId].map(([id, name]) => ({id, name})).sort((a, b) => a.name.localeCompare(b.name, "vi")));
      })
      .catch(e => setError(e instanceof Error ? e.message : String(e)));
  }, [isAdmin, load]);

  const cropName = useMemo(() => {
    const byId = new Map(crops.map(c => [c.id, c.name]));
    return (id: string) => byId.get(id) ?? id;
  }, [crops]);

  const edit = (g: Guide) =>
    setDraft({
      id: g.id,
      crop_type: g.crop_type,
      stage_code: g.stage_code ?? "",
      title: g.title,
      summary: g.summary ?? "",
      youtube: g.youtube_id ?? "",
      steps: g.steps.map(s => ({...s})),
      image_ids: [...g.image_ids],
      source_name: g.source_name ?? "",
      source_url: g.source_url ?? "",
      published: g.published,
      sort_order: g.sort_order,
    });

  const save = async () => {
    if (!draft) return;
    if (!draft.title.trim()) {
      setError("Nhập tiêu đề hướng dẫn.");
      return;
    }
    if (draft.youtube.trim() && !youtubeIdOf(draft.youtube)) {
      setError("Đường dẫn YouTube không nhận ra được. Dán link dạng youtube.com/watch?v=… hoặc youtu.be/…");
      return;
    }
    setBusy(true);
    setError(null);
    setNote(null);
    const body = {
      crop_type: draft.crop_type,
      stage_code: draft.stage_code || null,
      title: draft.title.trim(),
      summary: draft.summary.trim() || null,
      youtube: draft.youtube.trim() || null,
      steps: draft.steps.filter(s => s.title.trim()).map(s => ({...s, title: s.title.trim()})),
      image_ids: draft.image_ids,
      source_name: draft.source_name.trim() || null,
      source_url: draft.source_url.trim() || null,
      published: draft.published,
      sort_order: draft.sort_order,
    };
    try {
      if (draft.id) {
        await api<Guide>(`/care-guides/${draft.id}`, {method: "PATCH", body: JSON.stringify(body)});
      } else {
        await api<Guide>("/care-guides", {method: "POST", body: JSON.stringify(body)});
      }
      setNote(`Đã lưu "${body.title}"${body.published ? " — điện thoại nhận được ở lần đồng bộ tới" : " (bản nháp)"}`);
      setDraft(null);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Không lưu được hướng dẫn");
    } finally {
      setBusy(false);
    }
  };

  const togglePublished = async (g: Guide) => {
    setError(null);
    try {
      await api<Guide>(`/care-guides/${g.id}`, {method: "PATCH", body: JSON.stringify({published: !g.published})});
      setNote(g.published ? `Đã gỡ "${g.title}" khỏi điện thoại` : `Đã đăng "${g.title}"`);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Không cập nhật được");
    }
  };

  const remove = async (g: Guide) => {
    const ok = await confirm({
      title: "Xoá hướng dẫn",
      message: `Xoá hướng dẫn “${g.title}”? Điện thoại sẽ mất hướng dẫn này ở lần đồng bộ tới.`,
      confirmLabel: "Xoá",
      danger: true,
    });
    if (!ok) return;
    try {
      await api<void>(`/care-guides/${g.id}`, {method: "DELETE"});
      setNote(`Đã xoá "${g.title}"`);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Không xoá được");
    }
  };

  const addImage = async (file: File | undefined, target: "strip" | number) => {
    if (!file || !draft) return;
    setUploading(String(target));
    setError(null);
    try {
      const id = await uploadPublicImage(file);
      setDraft(d =>
        !d
          ? d
          : target === "strip"
            ? {...d, image_ids: [...d.image_ids, id]}
            : {...d, steps: d.steps.map((s, i) => (i === target ? {...s, image_id: id} : s))},
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Không tải ảnh lên được");
    } finally {
      setUploading(null);
    }
  };

  const setStep = (index: number, patch: Partial<Step>) =>
    setDraft(d => (d ? {...d, steps: d.steps.map((s, i) => (i === index ? {...s, ...patch} : s))} : d));

  const moveStep = (index: number, by: -1 | 1) =>
    setDraft(d => {
      if (!d) return d;
      const next = [...d.steps];
      const target = index + by;
      if (target < 0 || target >= next.length) return d;
      [next[index], next[target]] = [next[target], next[index]];
      return {...d, steps: next};
    });

  const filtered = useMemo(() => {
    const q = fold(query.trim());
    return (guides ?? [])
      .filter(g => (cropFilter === "all" ? true : g.crop_type === cropFilter))
      .filter(g => (stateFilter === "all" ? true : stateFilter === "published" ? g.published : !g.published))
      .filter(g => !q || fold(`${g.title} ${cropName(g.crop_type)} ${g.summary ?? ""}`).includes(q))
      .sort((a, b) => a.crop_type.localeCompare(b.crop_type) || a.sort_order - b.sort_order);
  }, [guides, cropFilter, stateFilter, query, cropName]);
  const paged = usePaged(filtered, 8);

  if (!isAdmin) return <Notice>Trang này chỉ dành cho quản trị viên.</Notice>;

  const previewId = draft ? youtubeIdOf(draft.youtube) : null;

  return (
    <>
      <PageHeader
        title="Hướng dẫn chăm sóc"
        subtitle="Video YouTube nhúng và ảnh từng bước — nông hộ xem ngay trong ứng dụng, kể cả khi mất mạng (video cần mạng lần đầu)."
        actions={
          !draft ? (
            <button className="btn btn-primary" type="button" onClick={() => setDraft({...EMPTY, crop_type: crops[0]?.id ?? "tomato"})}>
              <Icon name="plus" size={16} />
              Viết hướng dẫn
            </button>
          ) : undefined
        }
      />

      {error ? <Notice>{error}</Notice> : null}
      {note ? <Notice tone="green">{note}</Notice> : null}

      {draft ? (
        <div className="card">
          <h2 className="h3">{draft.id ? "Sửa hướng dẫn" : "Hướng dẫn mới"}</h2>
          <div className="form-grid">
            <label className="label inline">
              Cây trồng
              <select className="input" value={draft.crop_type} onChange={e => setDraft({...draft, crop_type: e.target.value})}>
                {crops.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="label inline">
              Giai đoạn
              <select className="input" value={draft.stage_code} onChange={e => setDraft({...draft, stage_code: e.target.value})}>
                {STAGES.map(s => (
                  <option key={s.code} value={s.code}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="label inline">
            Tiêu đề
            <input className="input" value={draft.title} maxLength={160} onChange={e => setDraft({...draft, title: e.target.value})} placeholder="VD: Bón thúc cà chua lần 1" />
          </label>
          <label className="label inline">
            Tóm tắt
            <textarea className="input textarea" rows={3} value={draft.summary} onChange={e => setDraft({...draft, summary: e.target.value})} placeholder="Làm khi nào, để làm gì — hai, ba câu." />
          </label>
          <label className="label inline">
            Video YouTube (dán đường dẫn)
            <input className="input" value={draft.youtube} onChange={e => setDraft({...draft, youtube: e.target.value})} placeholder="https://www.youtube.com/watch?v=…" />
          </label>
          {previewId ? (
            <div className="video-preview">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${previewId}?rel=0`}
                title="Xem trước video"
                referrerPolicy="strict-origin-when-cross-origin"
                allow="encrypted-media; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : draft.youtube.trim() ? (
            <p className="error small">Không nhận ra đường dẫn YouTube.</p>
          ) : null}

          <div>
            <p className="label">Ảnh minh hoạ (dải ảnh đầu bài)</p>
            <div className="thumbs">
              {draft.image_ids.map(id => (
                <figure key={id} className="thumb">
                  {/* eslint-disable-next-line @next/next/no-img-element -- served by our API, not Next */}
                  <img src={mediaUrl(id)} alt="Ảnh minh hoạ" />
                  <button className="btn-danger-sm" type="button" onClick={() => setDraft({...draft, image_ids: draft.image_ids.filter(x => x !== id)})}>
                    Bỏ
                  </button>
                </figure>
              ))}
              <label className="btn btn-secondary">
                {uploading === "strip" ? "Đang tải…" : "+ Thêm ảnh"}
                <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e => addImage(e.target.files?.[0], "strip")} />
              </label>
            </div>
          </div>

          <div className="steps">
            <p className="label">Các bước</p>
            {draft.steps.map((step, index) => (
              <div key={index} className="step-edit">
                <div className="row-between">
                  <strong>Bước {index + 1}</strong>
                  <div className="form-actions">
                    <button className="btn-secondary-sm" type="button" disabled={index === 0} onClick={() => moveStep(index, -1)} aria-label="Đưa lên">
                      ↑
                    </button>
                    <button className="btn-secondary-sm" type="button" disabled={index === draft.steps.length - 1} onClick={() => moveStep(index, 1)} aria-label="Đưa xuống">
                      ↓
                    </button>
                    <button className="btn-danger-sm" type="button" onClick={() => setDraft({...draft, steps: draft.steps.filter((_, i) => i !== index)})}>
                      Xoá bước
                    </button>
                  </div>
                </div>
                <input className="input" value={step.title} maxLength={160} onChange={e => setStep(index, {title: e.target.value})} placeholder="Tên bước — VD: Xới nhẹ quanh gốc" />
                <textarea className="input textarea" rows={2} value={step.body} onChange={e => setStep(index, {body: e.target.value})} placeholder="Làm thế nào, bao nhiêu, cách gốc bao xa…" />
                <div className="thumbs">
                  {step.image_id ? (
                    <figure className="thumb">
                      {/* eslint-disable-next-line @next/next/no-img-element -- served by our API, not Next */}
                      <img src={mediaUrl(step.image_id)} alt={`Ảnh bước ${index + 1}`} />
                      <button className="btn-danger-sm" type="button" onClick={() => setStep(index, {image_id: null})}>
                        Bỏ ảnh
                      </button>
                    </figure>
                  ) : null}
                  <label className="btn btn-secondary">
                    {uploading === String(index) ? "Đang tải…" : step.image_id ? "Đổi ảnh" : "+ Ảnh cho bước này"}
                    <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e => addImage(e.target.files?.[0], index)} />
                  </label>
                </div>
              </div>
            ))}
            <button className="btn btn-secondary" type="button" onClick={() => setDraft({...draft, steps: [...draft.steps, {title: "", body: "", image_id: null}]})}>
              + Thêm bước
            </button>
          </div>

          <div className="form-grid">
            <label className="label inline">
              Nguồn (cơ quan, kênh)
              <input className="input" value={draft.source_name} onChange={e => setDraft({...draft, source_name: e.target.value})} placeholder="VD: Trung tâm Khuyến nông Quốc gia" />
            </label>
            <label className="label inline">
              Đường dẫn nguồn
              <input className="input" value={draft.source_url} onChange={e => setDraft({...draft, source_url: e.target.value})} placeholder="https://…" />
            </label>
          </div>
          <label className="label" style={{display: "flex", gap: "8px", alignItems: "center"}}>
            <input type="checkbox" checked={draft.published} onChange={e => setDraft({...draft, published: e.target.checked})} />
            Đăng lên điện thoại (bỏ chọn để lưu nháp)
          </label>
          <div className="form-actions">
            <button className="btn btn-primary" type="button" disabled={busy || uploading !== null} onClick={save}>
              {busy ? "Đang lưu…" : "Lưu hướng dẫn"}
            </button>
            <button className="btn btn-secondary" type="button" onClick={() => setDraft(null)}>
              Huỷ
            </button>
          </div>
        </div>
      ) : null}

      <Panel flush>
        <div className="toolbar">
          <SearchBox value={query} onChange={setQuery} placeholder="Tìm theo tiêu đề, cây trồng…" label="Tìm hướng dẫn" />
          <FilterSelect label="Cây trồng" value={cropFilter} onChange={setCropFilter} options={[{value: "all", label: "Tất cả"}, ...crops.map(c => ({value: c.id, label: c.name}))]} />
          <FilterSelect
            label="Trạng thái"
            value={stateFilter}
            onChange={setStateFilter}
            options={[
              {value: "all", label: "Tất cả"},
              {value: "published", label: "Đã đăng"},
              {value: "draft", label: "Bản nháp"},
            ]}
          />
        </div>
        {guides === null && !error ? (
          <TableSkeleton rows={4} cols={5} />
        ) : filtered.length === 0 ? (
          <EmptyState icon="guides" title={guides && guides.length === 0 ? "Chưa có hướng dẫn nào" : "Không có hướng dẫn nào khớp"} hint="Bấm “Viết hướng dẫn” để soạn bài đầu tiên." />
        ) : (
          <>
            <div className="data-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tiêu đề</th>
                    <th>Cây / giai đoạn</th>
                    <th>Nội dung</th>
                    <th>Trạng thái</th>
                    <th aria-label="Thao tác" />
                  </tr>
                </thead>
                <tbody>
                  {paged.slice.map(g => (
                    <tr key={g.id}>
                      <td style={{maxWidth: 380}}>
                        <span className="cell-main">{g.title}</span>
                        {g.source_name ? <span className="cell-sub">{g.source_name}</span> : null}
                      </td>
                      <td>
                        <span className="cell-main" style={{fontWeight: 600}}>
                          {cropName(g.crop_type)}
                        </span>
                        <span className="cell-sub">{g.stage_code ? stageLabel(g.stage_code) : "Mọi giai đoạn"}</span>
                      </td>
                      <td>
                        {[g.youtube_id ? "Video" : null, g.steps.length ? `${g.steps.length} bước` : null, g.image_ids.length ? `${g.image_ids.length} ảnh` : null]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </td>
                      <td>
                        <Pill tone={g.published ? "green" : "gray"}>{g.published ? "Đã đăng" : "Bản nháp"}</Pill>
                      </td>
                      <td>
                        <div className="cell-actions">
                          <button className="btn btn-secondary btn-sm" type="button" onClick={() => edit(g)}>
                            Sửa
                          </button>
                          <button className="btn btn-secondary btn-sm" type="button" onClick={() => togglePublished(g)}>
                            {g.published ? "Gỡ xuống" : "Đăng"}
                          </button>
                          <button className="icon-btn icon-btn-danger" type="button" onClick={() => remove(g)} aria-label={`Xoá ${g.title}`} title="Xoá">
                            <Icon name="trash" size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager {...paged} onPage={paged.setPage} noun="hướng dẫn" />
          </>
        )}
      </Panel>
      {dialog}
    </>
  );
}
