"use client";

/**
 * Nhật ký lỗi — các lỗi điện thoại tự gửi lên (qua khung chặn lỗi của ứng dụng)
 * hoặc do nông hộ bấm “Báo lỗi”. Điện thoại xếp hàng khi mất mạng nên thời điểm
 * xảy ra lỗi (`occurred_at`) có thể sớm hơn nhiều so với lúc máy chủ nhận được.
 *
 * Nguồn: GET /logs (chỉ quản trị viên, tối đa 500 dòng mới nhất).
 */

import {Fragment, useEffect, useMemo, useState} from "react";

import {Icon} from "@/components/admin/Icon";
import {useAdmin} from "@/components/admin/Shell";
import {EmptyState, FilterSelect, Kpi, Notice, PageHeader, Pager, Panel, Pill, SearchBox, TableSkeleton, usePaged} from "@/components/admin/ui";
import {api} from "@/lib/api";
import {fold, formatDateTime} from "@/lib/format";

interface LogRow {
  id: string;
  user_id: string;
  action: string;
  message: string;
  stack: string | null;
  app_version: string | null;
  platform: string | null;
  occurred_at: number;
  created_at: number;
  reported: boolean;
}

interface UserRow {
  id: string;
  username: string;
  full_name: string;
}

const DAY = 24 * 60 * 60 * 1000;

export default function LogsPage() {
  const {isAdmin} = useAdmin();
  const [logs, setLogs] = useState<LogRow[] | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [owner, setOwner] = useState("all");
  const [kind, setKind] = useState("all");
  const [range, setRange] = useState("all");
  const [open, setOpen] = useState<string | null>(null);
  // Mốc "bây giờ" cố định cho cả lần hiển thị: gọi Date.now() ngay trong thân
  // render sẽ cho kết quả khác nhau giữa hai lần vẽ lại.
  const [now] = useState(() => Date.now());

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    Promise.all([api<LogRow[]>("/logs?limit=500"), api<UserRow[]>("/users")])
      .then(([l, u]) => {
        if (cancelled) return;
        setLogs(l);
        setUsers(u);
      })
      .catch(e => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const names = useMemo(() => new Map(users.map(u => [u.id, u])), [users]);

  const filtered = useMemo(() => {
    const q = fold(query.trim());
    const since = range === "all" ? 0 : now - Number(range) * DAY;
    return (logs ?? [])
      .filter(l => (owner === "all" ? true : l.user_id === owner))
      .filter(l => (kind === "all" ? true : kind === "reported" ? l.reported : !l.reported))
      .filter(l => l.occurred_at >= since)
      .filter(l => !q || fold(`${l.action} ${l.message} ${names.get(l.user_id)?.full_name ?? ""}`).includes(q));
  }, [logs, owner, kind, range, query, names, now]);

  const paged = usePaged(filtered, 10);

  if (!isAdmin) return <Notice>Trang này chỉ dành cho quản trị viên.</Notice>;

  const last7 = (logs ?? []).filter(l => l.occurred_at >= now - 7 * DAY).length;
  const reported = (logs ?? []).filter(l => l.reported).length;
  const affected = new Set((logs ?? []).map(l => l.user_id)).size;

  return (
    <>
      <PageHeader title="Nhật ký lỗi" subtitle="Lỗi do ứng dụng điện thoại gửi lên, mới nhất ở trên cùng" />
      {error ? <Notice>{error}</Notice> : null}

      <section className="grid grid-kpi grid-kpi-3" aria-label="Tóm tắt lỗi">
        <Kpi label="Trong 7 ngày qua" icon="logs" tone={last7 ? "red" : "green"} value={logs ? last7 : "—"} hint="Theo thời điểm lỗi xảy ra trên máy" />
        <Kpi label="Do nông hộ bấm “Báo lỗi”" icon="alert" tone="amber" value={logs ? reported : "—"} hint="Có kèm mô tả của người dùng" />
        <Kpi label="Nông hộ bị ảnh hưởng" icon="farms" tone="blue" value={logs ? affected : "—"} hint={logs ? `trong ${logs.length} dòng nhật ký` : undefined} />
      </section>

      <Panel flush>
        <div className="toolbar">
          <SearchBox value={query} onChange={setQuery} placeholder="Tìm theo màn hình, nội dung lỗi, nông hộ…" label="Tìm trong nhật ký" />
          <FilterSelect
            label="Nông hộ"
            value={owner}
            onChange={setOwner}
            options={[{value: "all", label: "Tất cả"}, ...users.filter(u => (logs ?? []).some(l => l.user_id === u.id)).map(u => ({value: u.id, label: u.full_name}))]}
          />
          <FilterSelect
            label="Nguồn"
            value={kind}
            onChange={setKind}
            options={[
              {value: "all", label: "Tất cả"},
              {value: "auto", label: "Tự động gửi"},
              {value: "reported", label: "Nông hộ báo lỗi"},
            ]}
          />
          <FilterSelect
            label="Thời gian"
            value={range}
            onChange={setRange}
            options={[
              {value: "all", label: "Tất cả"},
              {value: "7", label: "7 ngày"},
              {value: "30", label: "30 ngày"},
            ]}
          />
        </div>

        {logs === null && !error ? (
          <TableSkeleton rows={6} cols={5} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="check"
            title={logs && logs.length === 0 ? "Chưa có lỗi nào được gửi lên" : "Không có dòng nhật ký nào khớp"}
            hint={logs && logs.length === 0 ? "Khi ứng dụng gặp lỗi, điện thoại tự gửi về đây ngay khi có mạng." : undefined}
          />
        ) : (
          <>
            <div className="data-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Thời điểm</th>
                    <th>Nông hộ</th>
                    <th>Màn hình / thao tác</th>
                    <th>Nội dung</th>
                    <th>Nguồn</th>
                    <th aria-label="Chi tiết" />
                  </tr>
                </thead>
                <tbody>
                  {paged.slice.map(l => (
                    <Fragment key={l.id}>
                      <tr>
                        <td className="nowrap">
                          <span className="cell-main">{formatDateTime(l.occurred_at)}</span>
                          <span className="cell-sub">
                            {l.platform ?? "—"} · v{l.app_version ?? "?"}
                          </span>
                        </td>
                        <td>{names.get(l.user_id)?.full_name ?? l.user_id}</td>
                        <td>{l.action}</td>
                        <td style={{maxWidth: 360}}>
                          <span className="cell-main" style={{fontWeight: 600}}>
                            {l.message}
                          </span>
                        </td>
                        <td>
                          <Pill tone={l.reported ? "amber" : "gray"}>{l.reported ? "Nông hộ báo" : "Tự động"}</Pill>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => setOpen(open === l.id ? null : l.id)}
                            aria-expanded={open === l.id}
                            aria-label="Xem chi tiết"
                            title="Chi tiết"
                          >
                            <Icon name={open === l.id ? "close" : "chevronRight"} size={16} />
                          </button>
                        </td>
                      </tr>
                      {open === l.id ? (
                        <tr>
                          <td colSpan={6}>
                            <pre className="log-detail">
                              {`Mã nhật ký: ${l.id}\nXảy ra: ${formatDateTime(l.occurred_at)}\nMáy chủ nhận: ${formatDateTime(l.created_at)}\n\n${l.message}${l.stack ? `\n\n${l.stack}` : "\n\n(Không có dấu vết ngăn xếp)"}`}
                            </pre>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager {...paged} onPage={paged.setPage} noun="dòng" />
          </>
        )}
      </Panel>
    </>
  );
}
