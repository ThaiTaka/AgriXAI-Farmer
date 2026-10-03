"use client";

/**
 * Thông báo — messages for the farmers' phones.
 *
 * What is sent here reaches the phones through the sync (every minute while
 * the app is open, about every 15 minutes in the background) and rings them;
 * the inbox works offline. The list also holds what the server sent on its
 * own — weather warnings and price changes — and shows, per message, how many
 * of the farms it was meant for have opened it. Taking a message back removes
 * it from every phone at the next sync.
 */

import {FormEvent, useEffect, useMemo, useState} from "react";

import {useAdmin} from "@/components/AdminShell";
import {IconBell, IconEdit, IconTrash, IconWeather, IconPrice} from "@/components/icons";
import {EmptyState, Meter, Modal, PageHeader, Panel, Pill, Segmented, Skeleton, Toast} from "@/components/ui";
import {api} from "@/lib/api";
import {formatDateTime, timeAgo} from "@/lib/format";
import type {AppNotice} from "@/lib/types";
import {useNow} from "@/lib/useNow";

type Level = "info" | "warning" | "danger";
type KindFilter = "all" | "announcement" | "weather" | "price";

const LEVELS: {value: Level; label: string}[] = [
  {value: "info", label: "Thông tin"},
  {value: "warning", label: "Lưu ý"},
  {value: "danger", label: "Khẩn"},
];
const LEVEL_TONE: Record<string, "green" | "amber" | "red"> = {info: "green", warning: "amber", danger: "red"};
const KIND: Record<string, {label: string; icon: React.ReactNode}> = {
  announcement: {label: "Ban quản lý", icon: <IconBell size={16} />},
  weather: {label: "Thời tiết", icon: <IconWeather size={16} />},
  price: {label: "Giá phân bón", icon: <IconPrice size={16} />},
};
const LINKS = [
  {value: "", label: "Không mở màn nào"},
  {value: "weather", label: "Màn thời tiết"},
  {value: "prices", label: "Bảng giá phân bón"},
];

interface Draft {
  title: string;
  body: string;
  level: Level;
  owner_id: string;
  link: string;
  expires: string;
}

const EMPTY: Draft = {title: "", body: "", level: "info", owner_id: "", link: "", expires: ""};

export default function NotificationsPage() {
  const {farms} = useAdmin();
  const [rows, setRows] = useState<AppNotice[] | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [kind, setKind] = useState<KindFilter>("all");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [editing, setEditing] = useState<AppNotice | null>(null);

  const load = () =>
    api<AppNotice[]>("/notifications?limit=200")
      .then(setRows)
      .catch(e => setError(e instanceof Error ? e.message : String(e)));

  useEffect(() => {
    load();
  }, []);

  const visible = useMemo(() => (rows ?? []).filter(r => kind === "all" || r.kind === kind), [rows, kind]);
  const reach = useMemo(() => {
    const list = rows ?? [];
    const sent = list.reduce((s, r) => s + (r.audience_size ?? 0), 0);
    const read = list.reduce((s, r) => s + (r.read_count ?? 0), 0);
    return {sent, read, pct: sent > 0 ? Math.round((read / sent) * 100) : 0};
  }, [rows]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.title.trim()) return setError("Cần tiêu đề.");
    setSending(true);
    setError(null);
    try {
      const expires = draft.expires ? new Date(`${draft.expires}T23:59:59`).getTime() : null;
      await api<AppNotice>("/notifications", {
        method: "POST",
        body: JSON.stringify({
          title: draft.title.trim(),
          body: draft.body.trim(),
          level: draft.level,
          owner_id: draft.owner_id || null,
          link: draft.link || null,
          expires_at: expires,
        }),
      });
      const who = draft.owner_id ? farms.find(f => f.id === draft.owner_id)?.full_name ?? "1 nông hộ" : "mọi nông hộ";
      setDraft(EMPTY);
      setToast(`Đã gửi cho ${who} — điện thoại nhận ở lần đồng bộ tới`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  };

  const retract = async (n: AppNotice) => {
    if (!window.confirm(`Thu hồi "${n.title}"? Tin biến mất khỏi điện thoại các hộ ở lần đồng bộ tới.`)) return;
    try {
      await api(`/notifications/${n.id}`, {method: "DELETE"});
      setToast("Đã thu hồi thông báo");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const now = useNow();
  const set = (patch: Partial<Draft>) => setDraft(d => ({...d, ...patch}));

  return (
    <main className="page">
      <PageHeader
        title="Thông báo"
        subtitle="Gửi tin tới điện thoại nông hộ. Máy chủ cũng tự gửi cảnh báo mưa to, rét hại (QĐ 18/2021/QĐ-TTg) và giá phân bón mới."
      />

      <div className="grid grid-main">
        <Panel title="Soạn thông báo" subtitle="Điện thoại đổ chuông khi nhận; hộp thư mở được cả khi mất sóng.">
          <form className="form" style={{marginTop: 0}} onSubmit={send}>
            <label className="field">
              <span className="field-label">Tiêu đề</span>
              <input className="input" value={draft.title} onChange={e => set({title: e.target.value})} maxLength={160} placeholder="VD: Lịch tập huấn phòng bệnh cho hoa cúc" required />
            </label>
            <label className="field">
              <span className="field-label">Nội dung</span>
              <textarea className="input textarea" rows={4} value={draft.body} onChange={e => set({body: e.target.value})} maxLength={2000} placeholder="Ghi rõ thời gian, địa điểm, việc cần làm." />
              <span className="field-hint">{draft.body.length}/2000 ký tự</span>
            </label>
            <div className="form-grid">
              <div className="field">
                <span className="field-label">Mức độ</span>
                <Segmented<Level> label="Mức độ" value={draft.level} onChange={level => set({level})} options={LEVELS} />
              </div>
              <label className="field">
                <span className="field-label">Gửi tới</span>
                <select className="input" value={draft.owner_id} onChange={e => set({owner_id: e.target.value})}>
                  <option value="">Mọi nông hộ ({farms.length})</option>
                  {farms.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.full_name || f.username}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field-label">Chạm vào thì mở</span>
                <select className="input" value={draft.link} onChange={e => set({link: e.target.value})}>
                  {LINKS.map(l => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field-label">Hết hạn (không bắt buộc)</span>
                <input className="input" type="date" value={draft.expires} onChange={e => set({expires: e.target.value})} />
                <span className="field-hint">Sau ngày này tin chuyển sang mục “Đã qua”.</span>
              </label>
            </div>
            {error ? <p className="error">{error}</p> : null}
            <div className="form-actions">
              <button className="btn btn-primary" type="submit" disabled={sending}>
                <IconBell size={18} /> {sending ? "Đang gửi…" : "Gửi thông báo"}
              </button>
            </div>
          </form>
        </Panel>

        <Panel title="Mức độ tiếp cận" subtitle="Tỷ lệ nông hộ đã mở tin, trên tổng số lượt gửi.">
          {rows == null ? (
            <Skeleton height={160} />
          ) : (
            <div>
              <div className="weather-temp" style={{fontSize: 44}}>
                {reach.pct}%
              </div>
              <p className="text-muted" style={{marginTop: 6}}>
                {reach.read} lượt mở / {reach.sent} lượt gửi · {rows.length} thông báo
              </p>
              <div style={{marginTop: 14}}>
                <Meter value={reach.read} max={reach.sent} label="Tỷ lệ đã mở" />
              </div>
              <div className="list" style={{marginTop: 18, marginInline: -22}}>
                {(["announcement", "weather", "price"] as const).map(k => {
                  const list = rows.filter(r => r.kind === k);
                  return (
                    <div key={k} className="list-row" style={{paddingBlock: 10}}>
                      <span className="stat-icon tone-green" style={{width: 34, height: 34, borderRadius: 10}}>
                        {KIND[k].icon}
                      </span>
                      <div className="list-row-main">
                        <div className="list-row-title">{KIND[k].label}</div>
                        <div className="list-row-sub">{list.length} thông báo</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Panel>
      </div>

      <Panel
        title="Đã gửi"
        subtitle={rows ? `${visible.length} thông báo` : undefined}
        action={
          <Segmented<KindFilter>
            label="Loại"
            value={kind}
            onChange={setKind}
            options={[
              {value: "all", label: "Tất cả"},
              {value: "announcement", label: "Ban quản lý"},
              {value: "weather", label: "Thời tiết"},
              {value: "price", label: "Giá"},
            ]}
          />
        }
        flush>
        {rows == null ? (
          <div className="panel-body">
            <Skeleton height={160} />
          </div>
        ) : visible.length === 0 ? (
          <EmptyState icon={<IconBell />} title="Chưa có thông báo" body="Thông báo đã gửi, cảnh báo thời tiết và tin giá mới sẽ hiện ở đây." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Thông báo</th>
                  <th>Loại</th>
                  <th>Gửi tới</th>
                  <th>Đã xem</th>
                  <th>Gửi lúc</th>
                  <th aria-label="Thao tác" />
                </tr>
              </thead>
              <tbody>
                {visible.map(n => {
                  const expired = n.expires_at != null && n.expires_at <= now;
                  return (
                    <tr key={n.id}>
                      <td className="wrap" style={{maxWidth: 460}}>
                        <div className="row" style={{gap: 8}}>
                          <Pill tone={LEVEL_TONE[n.level] ?? "gray"}>{LEVELS.find(l => l.value === n.level)?.label ?? n.level}</Pill>
                          {expired ? <Pill tone="gray">Đã qua</Pill> : null}
                        </div>
                        <div className="cell-main" style={{marginTop: 6}}>
                          {n.title}
                        </div>
                        {n.body ? (
                          <div className="cell-sub" style={{whiteSpace: "pre-line"}}>
                            {n.body.length > 220 ? `${n.body.slice(0, 220)}…` : n.body}
                          </div>
                        ) : null}
                      </td>
                      <td>
                        <span className="row" style={{gap: 6}}>
                          {KIND[n.kind]?.icon}
                          {KIND[n.kind]?.label ?? n.kind}
                        </span>
                      </td>
                      <td>{n.audience_label}</td>
                      <td style={{minWidth: 140}}>
                        <div className="text-sm tabular" style={{fontWeight: 700}}>
                          {n.read_count ?? 0}/{n.audience_size ?? 0}
                        </div>
                        <Meter value={n.read_count ?? 0} max={n.audience_size ?? 0} label="Đã xem" />
                      </td>
                      <td title={formatDateTime(n.created_at)}>{timeAgo(n.created_at, now)}</td>
                      <td>
                        <div className="row-actions">
                          <button className="btn btn-secondary btn-sm" onClick={() => setEditing(n)} aria-label="Sửa">
                            <IconEdit size={16} />
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => retract(n)} aria-label="Thu hồi">
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

      {editing ? (
        <EditNotice
          notice={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            setToast("Đã sửa — tin hiện lại là chưa đọc trên điện thoại");
            await load();
          }}
        />
      ) : null}
      {toast ? <Toast message={toast} onDone={() => setToast(null)} /> : null}
    </main>
  );
}

function EditNotice({notice, onClose, onSaved}: {notice: AppNotice; onClose: () => void; onSaved: () => Promise<void>}) {
  const [title, setTitle] = useState(notice.title);
  const [body, setBody] = useState(notice.body);
  const [level, setLevel] = useState<Level>((notice.level as Level) ?? "info");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api(`/notifications/${notice.id}`, {method: "PATCH", body: JSON.stringify({title, body, level})});
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  };

  return (
    <Modal title="Sửa thông báo" onClose={onClose}>
      <form className="form" onSubmit={save}>
        <label className="field">
          <span className="field-label">Tiêu đề</span>
          <input className="input" value={title} onChange={e => setTitle(e.target.value)} maxLength={160} required />
        </label>
        <label className="field">
          <span className="field-label">Nội dung</span>
          <textarea className="input textarea" rows={5} value={body} onChange={e => setBody(e.target.value)} maxLength={2000} />
        </label>
        <div className="field">
          <span className="field-label">Mức độ</span>
          <Segmented<Level> label="Mức độ" value={level} onChange={setLevel} options={LEVELS} />
        </div>
        <p className="field-hint">Người nhận không đổi được sau khi gửi. Sửa xong, tin hiện lại là chưa đọc trên điện thoại.</p>
        {error ? <p className="error">{error}</p> : null}
        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? "Đang lưu…" : "Lưu"}
          </button>
          <button className="btn btn-secondary" type="button" onClick={onClose}>
            Huỷ
          </button>
        </div>
      </form>
    </Modal>
  );
}
