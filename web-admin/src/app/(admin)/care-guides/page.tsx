"use client";

/**
 * Hướng dẫn chăm sóc — where an admin writes a guide for one crop (and
 * optionally one stage): an embedded YouTube video, an image strip and
 * illustrated steps, with the source it comes from.
 *
 * Guides reach the phones through sync (the shared care_guides table), so a
 * farmer reads them with no signal; the video and images need the network the
 * first time. Only "Đã đăng" guides show on the phone — drafts are for writing.
 *
 * Images uploaded here are public (anyone with the link can see them) because
 * they are shared teaching material, not a farm's own photos.
 */

import {useEffect, useMemo, useState} from "react";

import {IconBook, IconCheck, IconEdit, IconExternal, IconPlus, IconSearch, IconTrash} from "@/components/icons";
import {EmptyState, PageHeader, Panel, Pill, Segmented, Skeleton, StatCard, Toast} from "@/components/ui";
import {api, ApiError, apiUpload, mediaUrl} from "@/lib/api";
import {timeAgo} from "@/lib/format";

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

type StatusFilter = "all" | "published" | "draft";

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
  const match = /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/))([A-Za-z0-9_-]{11})/.exec(v);
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
  const [guides, setGuides] = useState<Guide[] | null>(null);
  const [crops, setCrops] = useState<{id: string; name: string}[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<{message: string; tone?: "green" | "red"} | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [crop, setCrop] = useState("all");
  const [query, setQuery] = useState("");

  const load = () => api<Guide[]>("/care-guides").then(setGuides);

  useEffect(() => {
    Promise.all([load(), api<Variety[]>("/crop-varieties")])
      .then(([, varieties]) => {
        const byId = new Map<string, string>();
        for (const v of varieties) if (!byId.has(v.crop_type)) byId.set(v.crop_type, v.crop_name);
        setCrops([...byId].map(([id, name]) => ({id, name})).sort((a, b) => a.name.localeCompare(b.name, "vi")));
      })
      .catch(e => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const cropName = useMemo(() => {
    const byId = new Map(crops.map(c => [c.id, c.name]));
    return (id: string) => byId.get(id) ?? id;
  }, [crops]);

  const all = guides ?? [];
  const counts = {
    all: all.length,
    published: all.filter(g => g.published).length,
    draft: all.filter(g => !g.published).length,
    video: all.filter(g => g.youtube_id).length,
    covered: new Set(all.filter(g => g.published).map(g => g.crop_type)).size,
  };

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("vi");
    return (guides ?? [])
      .filter(g => status === "all" || g.published === (status === "published"))
      .filter(g => crop === "all" || g.crop_type === crop)
      .filter(g => !q || `${g.title} ${g.summary ?? ""} ${cropName(g.crop_type)}`.toLocaleLowerCase("vi").includes(q))
      .sort((a, b) => b.updated_at - a.updated_at);
  }, [guides, status, crop, query, cropName]);

  const edit = (g: Guide) => {
    setFormError(null);
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
    window.scrollTo({top: 0, behavior: "smooth"});
  };

  const save = async () => {
    if (!draft) return;
    if (!draft.title.trim()) return setFormError("Nhập tiêu đề hướng dẫn.");
    if (draft.youtube.trim() && !youtubeIdOf(draft.youtube)) {
      return setFormError("Đường dẫn YouTube không nhận ra được. Dán link dạng youtube.com/watch?v=… hoặc youtu.be/…");
    }
    setBusy(true);
    setFormError(null);
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
      if (draft.id) await api<Guide>(`/care-guides/${draft.id}`, {method: "PATCH", body: JSON.stringify(body)});
      else await api<Guide>("/care-guides", {method: "POST", body: JSON.stringify(body)});
      setToast({message: `Đã lưu "${body.title}"${body.published ? " — điện thoại nhận ở lần đồng bộ tới" : " (bản nháp)"}`});
      setDraft(null);
      await load();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Không lưu được hướng dẫn");
    } finally {
      setBusy(false);
    }
  };

  const togglePublished = async (g: Guide) => {
    try {
      await api<Guide>(`/care-guides/${g.id}`, {method: "PATCH", body: JSON.stringify({published: !g.published})});
      setToast({message: g.published ? `Đã gỡ "${g.title}" khỏi điện thoại` : `Đã đăng "${g.title}"`});
      await load();
    } catch (e) {
      setToast({message: e instanceof ApiError ? e.message : "Không cập nhật được", tone: "red"});
    }
  };

  const remove = async (g: Guide) => {
    if (!window.confirm(`Xoá hướng dẫn "${g.title}"? Điện thoại sẽ mất hướng dẫn này ở lần đồng bộ tới.`)) return;
    try {
      await api<void>(`/care-guides/${g.id}`, {method: "DELETE"});
      setToast({message: `Đã xoá "${g.title}"`});
      await load();
    } catch (e) {
      setToast({message: e instanceof ApiError ? e.message : "Không xoá được", tone: "red"});
    }
  };

  const addImage = async (file: File | undefined, target: "strip" | number) => {
    if (!file || !draft) return;
    setUploading(String(target));
    setFormError(null);
    try {
      const id = await uploadPublicImage(file);
      setDraft(d =>
        !d ? d : target === "strip" ? {...d, image_ids: [...d.image_ids, id]} : {...d, steps: d.steps.map((s, i) => (i === target ? {...s, image_id: id} : s))},
      );
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Không tải ảnh lên được");
    } finally {
      setUploading(null);
    }
  };

  const setStep = (index: number, patch: Partial<Step>) => setDraft(d => (d ? {...d, steps: d.steps.map((s, i) => (i === index ? {...s, ...patch} : s))} : d));

  const moveStep = (index: number, by: -1 | 1) =>
    setDraft(d => {
      if (!d) return d;
      const next = [...d.steps];
      const target = index + by;
      if (target < 0 || target >= next.length) return d;
      [next[index], next[target]] = [next[target], next[index]];
      return {...d, steps: next};
    });

  const placeholder = <Skeleton height={28} width={40} />;

  if (draft) {
    const previewId = youtubeIdOf(draft.youtube);
    return (
      <main className="page">
        <PageHeader
          title={draft.id ? "Sửa hướng dẫn" : "Viết hướng dẫn mới"}
          subtitle="Bên phải là bản xem trước gần giống màn hình điện thoại của nông hộ."
          actions={
            <>
              <button className="btn btn-secondary" type="button" onClick={() => setDraft(null)}>
                Huỷ
              </button>
              <button className="btn btn-primary" type="button" disabled={busy || uploading !== null} onClick={save}>
                <IconCheck size={18} /> {busy ? "Đang lưu…" : draft.published ? "Lưu và đăng" : "Lưu nháp"}
              </button>
            </>
          }
        />
        {formError ? (
          <p className="error" role="alert">
            {formError}
          </p>
        ) : null}

        <div className="grid grid-main" style={{alignItems: "start"}}>
          <div className="grid" style={{gap: 20}}>
            <Panel title="Nội dung">
              <div className="form" style={{marginTop: 0}}>
                <div className="form-grid">
                  <label className="field">
                    <span className="field-label">Cây trồng</span>
                    <select className="input" value={draft.crop_type} onChange={e => setDraft({...draft, crop_type: e.target.value})}>
                      {crops.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span className="field-label">Giai đoạn</span>
                    <select className="input" value={draft.stage_code} onChange={e => setDraft({...draft, stage_code: e.target.value})}>
                      {STAGES.map(s => (
                        <option key={s.code} value={s.code}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="field">
                  <span className="field-label">Tiêu đề</span>
                  <input className="input" value={draft.title} maxLength={160} onChange={e => setDraft({...draft, title: e.target.value})} placeholder="VD: Bón thúc hoa cúc giai đoạn phân cành" />
                </label>
                <label className="field">
                  <span className="field-label">Tóm tắt</span>
                  <textarea className="input textarea" rows={3} value={draft.summary} onChange={e => setDraft({...draft, summary: e.target.value})} placeholder="Làm khi nào, để làm gì — hai, ba câu." />
                </label>
                <label className="field">
                  <span className="field-label">Video YouTube</span>
                  <input className="input" value={draft.youtube} onChange={e => setDraft({...draft, youtube: e.target.value})} placeholder="Dán đường dẫn: https://www.youtube.com/watch?v=…" />
                  {draft.youtube.trim() && !previewId ? <span className="field-hint" style={{color: "#b4432f"}}>Không nhận ra đường dẫn YouTube.</span> : <span className="field-hint">Nhúng bằng youtube-nocookie, không có video gợi ý khác kênh.</span>}
                </label>
              </div>
            </Panel>

            <Panel title="Ảnh minh hoạ" subtitle="Dải ảnh ở đầu bài. Ảnh tải lên là ảnh công khai.">
              <div className="thumbs">
                {draft.image_ids.map(id => (
                  <figure key={id} className="thumb">
                    {/* eslint-disable-next-line @next/next/no-img-element -- served by our API, not Next */}
                    <img src={mediaUrl(id)} alt="Ảnh minh hoạ" />
                    <button className="btn btn-danger btn-sm" type="button" onClick={() => setDraft({...draft, image_ids: draft.image_ids.filter(x => x !== id)})}>
                      <IconTrash size={14} /> Bỏ
                    </button>
                  </figure>
                ))}
                <label className="upload-tile">
                  <IconPlus size={22} />
                  {uploading === "strip" ? "Đang tải…" : "Thêm ảnh"}
                  <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e => addImage(e.target.files?.[0], "strip")} />
                </label>
              </div>
            </Panel>

            <Panel
              title="Các bước"
              subtitle="Mỗi bước một việc, có thể kèm một ảnh."
              action={
                <button className="btn btn-secondary btn-sm" type="button" onClick={() => setDraft({...draft, steps: [...draft.steps, {title: "", body: "", image_id: null}]})}>
                  <IconPlus size={16} /> Thêm bước
                </button>
              }>
              {draft.steps.length === 0 ? (
                <p className="text-muted text-sm" style={{margin: 0}}>
                  Chưa có bước nào.
                </p>
              ) : (
                <div className="grid" style={{gap: 14}}>
                  {draft.steps.map((step, index) => (
                    <div key={index} className="step-card">
                      <div className="row">
                        <span className="step-no">{index + 1}</span>
                        <input className="input" value={step.title} maxLength={160} onChange={e => setStep(index, {title: e.target.value})} placeholder="Tên bước — VD: Xới nhẹ quanh gốc" style={{flex: 1}} />
                        <button className="icon-btn" type="button" disabled={index === 0} onClick={() => moveStep(index, -1)} aria-label="Đưa lên" title="Đưa lên">
                          ↑
                        </button>
                        <button className="icon-btn" type="button" disabled={index === draft.steps.length - 1} onClick={() => moveStep(index, 1)} aria-label="Đưa xuống" title="Đưa xuống">
                          ↓
                        </button>
                        <button className="icon-btn" type="button" onClick={() => setDraft({...draft, steps: draft.steps.filter((_, i) => i !== index)})} aria-label="Xoá bước" title="Xoá bước">
                          <IconTrash size={18} />
                        </button>
                      </div>
                      <textarea className="input textarea" rows={2} value={step.body} onChange={e => setStep(index, {body: e.target.value})} placeholder="Làm thế nào, bao nhiêu, cách gốc bao xa…" />
                      <div className="thumbs">
                        {step.image_id ? (
                          <figure className="thumb">
                            {/* eslint-disable-next-line @next/next/no-img-element -- served by our API, not Next */}
                            <img src={mediaUrl(step.image_id)} alt={`Ảnh bước ${index + 1}`} />
                            <button className="btn btn-danger btn-sm" type="button" onClick={() => setStep(index, {image_id: null})}>
                              <IconTrash size={14} /> Bỏ ảnh
                            </button>
                          </figure>
                        ) : null}
                        <label className="btn btn-ghost btn-sm" style={{cursor: "pointer"}}>
                          <IconPlus size={16} /> {uploading === String(index) ? "Đang tải…" : step.image_id ? "Đổi ảnh" : "Ảnh cho bước này"}
                          <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e => addImage(e.target.files?.[0], index)} />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Nguồn và đăng">
              <div className="form" style={{marginTop: 0}}>
                <div className="form-grid">
                  <label className="field">
                    <span className="field-label">Nguồn (cơ quan, kênh)</span>
                    <input className="input" value={draft.source_name} onChange={e => setDraft({...draft, source_name: e.target.value})} placeholder="VD: Trung tâm Khuyến nông Lâm Đồng" />
                  </label>
                  <label className="field">
                    <span className="field-label">Đường dẫn nguồn</span>
                    <input className="input" value={draft.source_url} onChange={e => setDraft({...draft, source_url: e.target.value})} placeholder="https://…" />
                  </label>
                </div>
                <label className="toggle-row">
                  <input type="checkbox" checked={draft.published} onChange={e => setDraft({...draft, published: e.target.checked})} />
                  <span>
                    <strong>Đăng lên điện thoại</strong>
                    <span className="field-hint" style={{display: "block"}}>
                      Bỏ chọn để lưu nháp — nông hộ chưa thấy.
                    </span>
                  </span>
                </label>
              </div>
            </Panel>
          </div>

          <div className="sticky-col">
            <Panel title="Xem trước" subtitle="Trên điện thoại nông hộ">
              <div className="phone-preview">
                <div className="row row-wrap" style={{gap: 6}}>
                  <Pill tone="green">{cropName(draft.crop_type)}</Pill>
                  {draft.stage_code ? <Pill tone="lime">{stageLabel(draft.stage_code)}</Pill> : null}
                  {!draft.published ? <Pill tone="gray">Nháp</Pill> : null}
                </div>
                <h3 className="phone-preview-title">{draft.title || "Tiêu đề hướng dẫn"}</h3>
                {draft.summary ? <p className="phone-preview-text">{draft.summary}</p> : null}
                {previewId ? (
                  <div className="video-preview">
                    <iframe src={`https://www.youtube-nocookie.com/embed/${previewId}?rel=0`} title="Xem trước video" referrerPolicy="strict-origin-when-cross-origin" allow="encrypted-media; picture-in-picture" allowFullScreen />
                  </div>
                ) : null}
                {draft.image_ids.length > 0 ? (
                  <div className="phone-preview-strip">
                    {draft.image_ids.map(id => (
                      // eslint-disable-next-line @next/next/no-img-element -- served by our API, not Next
                      <img key={id} src={mediaUrl(id)} alt="" />
                    ))}
                  </div>
                ) : null}
                {draft.steps.filter(s => s.title.trim()).map((s, i) => (
                  <div key={i} className="phone-preview-step">
                    <span className="step-no">{i + 1}</span>
                    <div style={{minWidth: 0}}>
                      <div className="cell-main">{s.title}</div>
                      {s.body ? <p className="phone-preview-text">{s.body}</p> : null}
                      {s.image_id ? (
                        // eslint-disable-next-line @next/next/no-img-element -- served by our API, not Next
                        <img className="phone-preview-step-img" src={mediaUrl(s.image_id)} alt="" />
                      ) : null}
                    </div>
                  </div>
                ))}
                {draft.source_name ? <p className="cell-sub">Nguồn: {draft.source_name}</p> : null}
              </div>
            </Panel>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <PageHeader
        title="Hướng dẫn chăm sóc"
        subtitle="Video YouTube nhúng và ảnh từng bước — nông hộ xem ngay trong ứng dụng, đọc được cả khi mất sóng."
        actions={
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => {
              setFormError(null);
              setDraft({...EMPTY, crop_type: crop !== "all" ? crop : (crops[0]?.id ?? "tomato")});
            }}>
            <IconPlus size={18} /> Viết hướng dẫn
          </button>
        }
      />
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid grid-kpi">
        <StatCard label="Hướng dẫn" tone="green" icon={<IconBook size={22} />} value={guides ? counts.all : placeholder} sub={`${counts.draft} bản nháp`} />
        <StatCard label="Đã đăng" tone="lime" icon={<IconCheck size={22} />} value={guides ? counts.published : placeholder} sub="Đang hiện trên điện thoại" />
        <StatCard label="Có video" tone="coral" icon={<IconBook size={22} />} value={guides ? counts.video : placeholder} sub="Nhúng từ YouTube" />
        <StatCard label="Loại cây có hướng dẫn" tone="blue" icon={<IconBook size={22} />} value={guides ? `${counts.covered}/${crops.length}` : placeholder} sub="Tính các bài đã đăng" />
      </div>

      <Panel
        title="Tất cả hướng dẫn"
        action={
          <div className="toolbar">
            <Segmented<StatusFilter>
              label="Trạng thái"
              value={status}
              onChange={setStatus}
              options={[
                {value: "all", label: `Tất cả ${counts.all}`},
                {value: "published", label: `Đã đăng ${counts.published}`},
                {value: "draft", label: `Nháp ${counts.draft}`},
              ]}
            />
            <select className="input" value={crop} onChange={e => setCrop(e.target.value)} aria-label="Cây trồng">
              <option value="all">Mọi cây trồng</option>
              {crops.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <label className="search">
              <IconSearch size={18} />
              <input className="input" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm hướng dẫn" aria-label="Tìm hướng dẫn" />
            </label>
          </div>
        }>
        {guides == null ? (
          <Skeleton height={220} />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<IconBook />}
            title={counts.all === 0 ? "Chưa có hướng dẫn nào" : "Không có hướng dẫn nào khớp"}
            body={counts.all === 0 ? "Bấm “Viết hướng dẫn” để soạn bài đầu tiên: chọn cây, dán link video, thêm các bước có ảnh." : "Thử bỏ bớt bộ lọc hoặc từ tìm kiếm."}
          />
        ) : (
          <div className="guide-grid">
            {visible.map(g => (
              <article key={g.id} className="guide-card">
                <GuideCover guide={g} />
                <div className="guide-card-body">
                  <div className="row row-wrap" style={{gap: 6}}>
                    <Pill tone="green">{cropName(g.crop_type)}</Pill>
                    {g.stage_code ? <Pill tone="lime">{stageLabel(g.stage_code)}</Pill> : null}
                    {g.published ? <Pill tone="blue">Đã đăng</Pill> : <Pill tone="gray">Nháp</Pill>}
                  </div>
                  <h3 className="guide-card-title">{g.title}</h3>
                  {g.summary ? <p className="guide-card-text">{g.summary}</p> : null}
                  <div className="cell-sub">
                    {[g.youtube_id ? "Video" : null, g.steps.length ? `${g.steps.length} bước` : null, g.image_ids.length ? `${g.image_ids.length} ảnh` : null].filter(Boolean).join(" · ") || "Chỉ có chữ"} · sửa {timeAgo(g.updated_at)}
                  </div>
                  {g.source_name ? (
                    <div className="cell-sub guide-card-source" title={g.source_name}>
                      Nguồn:{" "}
                      {g.source_url ? (
                        <a href={g.source_url} target="_blank" rel="noreferrer">
                          {g.source_name} <IconExternal size={12} />
                        </a>
                      ) : (
                        g.source_name
                      )}
                    </div>
                  ) : null}
                </div>
                <div className="guide-card-actions">
                  <button className="btn btn-secondary btn-sm" type="button" onClick={() => edit(g)}>
                    <IconEdit size={16} /> Sửa
                  </button>
                  <button className={g.published ? "btn btn-ghost btn-sm" : "btn btn-primary btn-sm"} type="button" onClick={() => togglePublished(g)}>
                    {g.published ? "Gỡ xuống" : "Đăng"}
                  </button>
                  <span className="spacer" />
                  <button className="icon-btn" type="button" onClick={() => remove(g)} aria-label={`Xoá ${g.title}`} title="Xoá">
                    <IconTrash size={18} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </Panel>
      {toast ? <Toast message={toast.message} tone={toast.tone} onDone={() => setToast(null)} /> : null}
    </main>
  );
}

/** The video's thumbnail, else the first image, else a plain tile. */
function GuideCover({guide}: {guide: Guide}) {
  const [failed, setFailed] = useState(false);
  const src = guide.youtube_id ? `https://i.ytimg.com/vi/${guide.youtube_id}/mqdefault.jpg` : guide.image_ids[0] ? mediaUrl(guide.image_ids[0]) : null;
  return (
    <div className="guide-cover">
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- YouTube or our API, not Next
        <img src={src} alt="" onError={() => setFailed(true)} />
      ) : (
        <IconBook size={34} />
      )}
      {guide.youtube_id ? <span className="guide-play" aria-label="Có video" /> : null}
    </div>
  );
}
