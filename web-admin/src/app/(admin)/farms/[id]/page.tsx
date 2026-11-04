"use client";

/**
 * Chi tiết một nông hộ — thông tin tài khoản, các lô đất được giao và sổ sách
 * (tồn kho, thu – chi, phiếu kho, kế hoạch bón phân). Chỉ quản trị viên.
 */

import Link from "next/link";
import {useParams} from "next/navigation";
import {useEffect, useState} from "react";

import {FarmView} from "@/components/admin/FarmView";
import {useAdmin} from "@/components/admin/Shell";
import {EmptyState, Notice, PageHeader, Panel, Pill, TableSkeleton} from "@/components/admin/ui";
import {api} from "@/lib/api";
import {PLOT_STATUS, cropLabel, formatArea, formatDateTime, plotAreaM2} from "@/lib/format";

interface UserRow {
  id: string;
  username: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  region: string | null;
  role: string;
  is_active: boolean;
  created_at: number;
}

interface PlotRow {
  id: string;
  code: string;
  name: string;
  crop_type: string;
  crop_name: string | null;
  variety_name: string | null;
  area: number;
  area_unit: string;
  status: string;
  planted_at: number | null;
}

export default function FarmDetailPage() {
  const {isAdmin} = useAdmin();
  const {id} = useParams<{id: string}>();
  const [user, setUser] = useState<UserRow | null | undefined>(undefined);
  const [plots, setPlots] = useState<PlotRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    Promise.all([api<UserRow[]>("/users"), api<PlotRow[]>(`/plots?owner_id=${id}`)])
      .then(([users, p]) => {
        if (cancelled) return;
        setUser(users.find(u => u.id === id) ?? null);
        setPlots(p);
      })
      .catch(e => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [id, isAdmin]);

  if (!isAdmin) return <Notice>Trang này chỉ dành cho quản trị viên.</Notice>;

  if (user === null) {
    return (
      <>
        <PageHeader title="Không tìm thấy nông hộ" />
        <EmptyState
          icon="farms"
          title="Nông hộ này không tồn tại hoặc đã bị xoá"
          action={
            <Link className="btn btn-secondary" href="/farms">
              Về danh sách nông hộ
            </Link>
          }
        />
      </>
    );
  }

  const totalArea = (plots ?? []).reduce((s, p) => s + plotAreaM2(p.area, p.area_unit), 0);

  return (
    <>
      <nav className="breadcrumb" aria-label="Đường dẫn">
        <Link href="/farms">Nông hộ</Link>
        <span aria-hidden>/</span>
        <span>{user?.full_name ?? "…"}</span>
      </nav>
      <PageHeader
        title={user?.full_name ?? "Đang tải…"}
        subtitle={user?.region ?? undefined}
        actions={
          user ? (
            <>
              <Pill tone={user.is_active ? "green" : "gray"}>{user.is_active ? "Đang hoạt động" : "Đã khoá"}</Pill>
              <Link className="btn btn-secondary" href={`/plots?owner=${user.id}`}>
                Lô đất của hộ
              </Link>
            </>
          ) : undefined
        }
      />
      {error ? <Notice>{error}</Notice> : null}

      <section className="grid grid-7-5">
        <Panel title="Lô đất được giao" subtitle={plots ? `${plots.length} lô · ${formatArea(totalArea)}` : undefined} flush>
          {plots === null ? (
            <TableSkeleton rows={2} cols={4} />
          ) : plots.length === 0 ? (
            <EmptyState icon="plots" title="Hộ này chưa được giao lô nào" action={<Link className="btn btn-primary" href={`/plots?owner=${id}&new=1`}>Giao lô mới</Link>} />
          ) : (
            <div className="data-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Lô</th>
                    <th>Cây trồng</th>
                    <th className="num">Diện tích</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {plots.map(p => {
                    const st = PLOT_STATUS[p.status] ?? {label: p.status, tone: "gray" as const};
                    return (
                      <tr key={p.id}>
                        <td>
                          <span className="cell-main">{p.name}</span>
                          <span className="cell-sub mono">{p.code}</span>
                        </td>
                        <td>
                          <span className="cell-main">{cropLabel(p.crop_type, p.crop_name)}</span>
                          {p.variety_name ? <span className="cell-sub">{p.variety_name}</span> : null}
                        </td>
                        <td className="num">{formatArea(plotAreaM2(p.area, p.area_unit))}</td>
                        <td>
                          <Pill tone={st.tone}>{st.label}</Pill>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Thông tin tài khoản">
          {!user ? (
            <TableSkeleton rows={4} cols={1} />
          ) : (
            <dl className="detail-list">
              <dt>Tên đăng nhập</dt>
              <dd className="mono">{user.username}</dd>
              <dt>Email</dt>
              <dd>{user.email ?? "—"}</dd>
              <dt>Điện thoại</dt>
              <dd>{user.phone ?? "—"}</dd>
              <dt>Địa chỉ</dt>
              <dd>{user.region ?? "—"}</dd>
              <dt>Tạo lúc</dt>
              <dd>{formatDateTime(user.created_at)}</dd>
            </dl>
          )}
        </Panel>
      </section>

      <FarmView ownerId={id} />
    </>
  );
}
