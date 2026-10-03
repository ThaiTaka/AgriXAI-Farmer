"use client";

/**
 * Nhật ký lỗi — what went wrong on the farmers' phones.
 *
 * The phone's error boundary queues every crash locally and uploads it once
 * online (POST /logs); "Báo lỗi" sends one on purpose. Each row says which
 * farm, which screen and what the farmer was doing, with the stack trace a
 * click away.
 */

import {Fragment, useEffect, useMemo, useState} from "react";

import {useAdmin} from "@/components/AdminShell";
import {IconAlert, IconChevronRight} from "@/components/icons";
import {EmptyState, PageHeader, Panel, Pill, Segmented, Skeleton, StatCard} from "@/components/ui";
import {api} from "@/lib/api";
import {formatDateTime, timeAgo} from "@/lib/format";
import type {ErrorLogRow} from "@/lib/types";
import {useNow} from "@/lib/useNow";

type Range = "7" | "30" | "all";

export default function LogsPage() {
  const {farms} = useAdmin();
  // Rows remember which filter they answer, so a new filter shows the skeleton.
  const [loaded, setLoaded] = useState<{owner: string; rows: ErrorLogRow[]} | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [owner, setOwner] = useState("all");
  const [range, setRange] = useState<Range>("30");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const qs = owner === "all" ? "" : `&owner_id=${encodeURIComponent(owner)}`;
    api<ErrorLogRow[]>(`/logs?limit=500${qs}`)
      .then(rows => alive && setLoaded({owner, rows}))
      .catch(e => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [owner]);
  const rows = loaded?.owner === owner ? loaded.rows : null;

  const name = useMemo(() => {
    const map = new Map(farms.map(f => [f.id, f.full_name || f.username]));
    return (id: string) => map.get(id) ?? "Quản trị viên";
  }, [farms]);

  const now = useNow();
  const visible = useMemo(() => {
    const since = range === "all" ? 0 : now - Number(range) * 86_400_000;
    return (rows ?? []).filter(r => r.occurred_at >= since);
  }, [rows, range, now]);

  const reported = visible.filter(r => r.reported).length;
  const versions = new Set(visible.map(r => r.app_version ?? "?")).size;

  return (
    <main className="page">
      <PageHeader title="Nhật ký lỗi" subtitle="Lỗi từ điện thoại nông hộ, gửi lên khi máy có mạng. Lỗi nông dân tự bấm “Báo lỗi” được đánh dấu riêng." />
      {error ? <p className="error">{error}</p> : null}

      <div className="grid grid-kpi">
        <StatCard label="Lỗi trong khoảng" tone="coral" icon={<IconAlert size={22} />} value={rows ? visible.length : <Skeleton height={28} width={40} />} sub={range === "all" ? "Toàn bộ" : `${range} ngày gần nhất`} />
        <StatCard label="Nông dân tự báo" tone="amber" icon={<IconAlert size={22} />} value={rows ? reported : <Skeleton height={28} width={40} />} sub="Bấm “Báo lỗi” trên màn hình lỗi" />
        <StatCard label="Phiên bản ứng dụng" tone="blue" icon={<IconAlert size={22} />} value={rows ? versions : <Skeleton height={28} width={40} />} sub="Số phiên bản khác nhau gặp lỗi" />
        <StatCard label="Nông hộ gặp lỗi" tone="gray" icon={<IconAlert size={22} />} value={rows ? new Set(visible.map(r => r.user_id)).size : <Skeleton height={28} width={40} />} sub={`/ ${farms.length} nông hộ`} />
      </div>

      <Panel
        title="Danh sách lỗi"
        action={
          <div className="toolbar">
            <select className="input" value={owner} onChange={e => setOwner(e.target.value)} aria-label="Lọc theo nông hộ">
              <option value="all">Mọi nông hộ</option>
              {farms.map(f => (
                <option key={f.id} value={f.id}>
                  {f.full_name || f.username}
                </option>
              ))}
            </select>
            <Segmented<Range>
              label="Khoảng thời gian"
              value={range}
              onChange={setRange}
              options={[
                {value: "7", label: "7 ngày"},
                {value: "30", label: "30 ngày"},
                {value: "all", label: "Tất cả"},
              ]}
            />
          </div>
        }
        flush>
        {rows == null ? (
          <div className="panel-body">
            <Skeleton height={160} />
          </div>
        ) : visible.length === 0 ? (
          <EmptyState icon={<IconAlert />} title="Không có lỗi nào" body="Điện thoại của các nông hộ chưa gửi lỗi nào trong khoảng thời gian này." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th aria-label="Mở" />
                  <th>Lúc</th>
                  <th>Nông hộ</th>
                  <th>Đang làm gì</th>
                  <th>Lỗi</th>
                  <th>Phiên bản</th>
                  <th>Nguồn</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(r => (
                  <Fragment key={r.id}>
                    <tr onClick={() => setOpen(open === r.id ? null : r.id)} style={{cursor: "pointer"}}>
                      <td style={{width: 36}}>
                        <span style={{display: "inline-flex", transform: open === r.id ? "rotate(90deg)" : undefined, transition: "transform 120ms"}}>
                          <IconChevronRight size={16} />
                        </span>
                      </td>
                      <td title={formatDateTime(r.occurred_at)}>{timeAgo(r.occurred_at, now)}</td>
                      <td>{name(r.user_id)}</td>
                      <td className="wrap">{r.action}</td>
                      <td className="wrap" style={{maxWidth: 360}}>
                        <span className="cell-main">{r.message.length > 140 ? `${r.message.slice(0, 140)}…` : r.message}</span>
                      </td>
                      <td>
                        {r.app_version ?? "—"}
                        {r.platform ? <div className="cell-sub">{r.platform}</div> : null}
                      </td>
                      <td>{r.reported ? <Pill tone="amber">Nông dân báo</Pill> : <Pill tone="gray">Tự động</Pill>}</td>
                    </tr>
                    {open === r.id ? (
                      <tr>
                        <td />
                        <td colSpan={6}>
                          <div className="cell-sub" style={{marginBottom: 6}}>
                            Xảy ra lúc {formatDateTime(r.occurred_at)}
                          </div>
                          <pre style={{margin: 0, padding: 12, borderRadius: 10, background: "#0f2418", color: "#d9e8dc", fontSize: 12, whiteSpace: "pre-wrap", maxHeight: 280, overflow: "auto"}}>
                            {r.message}
                            {r.stack ? `\n\n${r.stack}` : ""}
                          </pre>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </main>
  );
}
