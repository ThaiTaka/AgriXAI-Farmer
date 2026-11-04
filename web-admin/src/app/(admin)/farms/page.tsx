"use client";

/**
 * Nông hộ — danh sách mọi nông hộ kèm khu vực, số lô, cây đang trồng, kết quả
 * thu – chi tháng này và trạng thái tài khoản. Có tìm kiếm không dấu, lọc theo
 * khu vực / trạng thái và phân trang; bấm một hàng để mở sổ sách của hộ đó.
 *
 * Danh sách ghép từ ba nguồn có sẵn: /users, /plots và /admin/overview (thu – chi
 * tháng). Dữ liệu ở quy mô vài trăm hộ nên lọc và phân trang làm ở trình duyệt.
 */

import Link from "next/link";
import {useRouter} from "next/navigation";
import {useEffect, useMemo, useState} from "react";

import {useAdmin} from "@/components/admin/Shell";
import {EmptyState, FilterSelect, Notice, PageHeader, Pager, Panel, Pill, SearchBox, TableSkeleton, usePaged} from "@/components/admin/ui";
import {api, formatVnd} from "@/lib/api";
import {areaOf, cropLabel, fold, formatArea, plotAreaM2} from "@/lib/format";

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
  owner_id: string;
  crop_type: string;
  crop_name: string | null;
  area: number;
  area_unit: string;
}

interface Overview {
  year: number;
  month: number;
  farms: {owner_id: string; income: number; expense: number}[];
}

const today = new Date();

export default function FarmsPage() {
  const {isAdmin} = useAdmin();
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [plots, setPlots] = useState<PlotRow[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [area, setArea] = useState("all");
  const [status, setStatus] = useState("all");

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    Promise.all([
      api<UserRow[]>("/users"),
      api<PlotRow[]>("/plots"),
      api<Overview>(`/admin/overview?year=${today.getFullYear()}&month=${today.getMonth() + 1}&months=1`),
    ])
      .then(([u, p, o]) => {
        if (cancelled) return;
        setUsers(u.filter(x => x.role === "farmer"));
        setPlots(p);
        setOverview(o);
      })
      .catch(e => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const rows = useMemo(() => {
    const byOwner = new Map<string, PlotRow[]>();
    plots.forEach(p => byOwner.set(p.owner_id, [...(byOwner.get(p.owner_id) ?? []), p]));
    const money = new Map((overview?.farms ?? []).map(f => [f.owner_id, f]));
    return (users ?? []).map(u => {
      const mine = byOwner.get(u.id) ?? [];
      const m = money.get(u.id);
      return {
        user: u,
        plots: mine,
        areaM2: mine.reduce((s, p) => s + plotAreaM2(p.area, p.area_unit), 0),
        crops: [...new Set(mine.map(p => cropLabel(p.crop_type, p.crop_name)))],
        income: m?.income ?? 0,
        expense: m?.expense ?? 0,
        hasActivity: Boolean(m),
        area: areaOf(u.region),
      };
    });
  }, [users, plots, overview]);

  const areaOptions = useMemo(
    () => [{value: "all", label: "Tất cả khu vực"}, ...[...new Set(rows.map(r => r.area))].sort((a, b) => a.localeCompare(b, "vi")).map(a => ({value: a, label: a}))],
    [rows],
  );

  const filtered = useMemo(() => {
    const q = fold(query.trim());
    return rows
      .filter(r => (area === "all" ? true : r.area === area))
      .filter(r => (status === "all" ? true : status === "active" ? r.user.is_active : !r.user.is_active))
      .filter(r => !q || fold(`${r.user.full_name} ${r.user.username} ${r.user.region ?? ""} ${r.user.phone ?? ""}`).includes(q))
      .sort((a, b) => a.user.full_name.localeCompare(b.user.full_name, "vi"));
  }, [rows, query, area, status]);

  const paged = usePaged(filtered, 8);

  if (!isAdmin) return <Notice>Trang này chỉ dành cho quản trị viên.</Notice>;

  return (
    <>
      <PageHeader
        title="Nông hộ"
        subtitle={users ? `${users.length} nông hộ · số liệu thu – chi của tháng ${today.getMonth() + 1}/${today.getFullYear()}` : "Đang tải…"}
        actions={
          <Link className="btn btn-primary" href="/accounts">
            Thêm tài khoản
          </Link>
        }
      />
      {error ? <Notice>{error}</Notice> : null}

      <Panel flush>
        <div className="toolbar">
          <SearchBox value={query} onChange={setQuery} placeholder="Tìm theo tên, tài khoản, địa chỉ, điện thoại…" label="Tìm nông hộ" />
          <FilterSelect label="Khu vực" value={area} onChange={setArea} options={areaOptions} />
          <FilterSelect
            label="Trạng thái"
            value={status}
            onChange={setStatus}
            options={[
              {value: "all", label: "Tất cả"},
              {value: "active", label: "Đang hoạt động"},
              {value: "locked", label: "Đã khoá"},
            ]}
          />
        </div>

        {users === null && !error ? (
          <TableSkeleton rows={8} cols={5} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Không có nông hộ nào khớp"
            hint="Thử bỏ bớt bộ lọc hoặc đổi từ khoá. Tìm kiếm không phân biệt dấu: “ha” cũng ra “Hà”."
            action={
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => {
                  setQuery("");
                  setArea("all");
                  setStatus("all");
                }}
              >
                Xoá bộ lọc
              </button>
            }
          />
        ) : (
          <>
            <div className="data-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nông hộ</th>
                    <th>Địa chỉ</th>
                    <th>Lô đất</th>
                    <th>Cây trồng</th>
                    <th className="num">Thu – chi tháng này</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.slice.map(r => {
                    const profit = r.income - r.expense;
                    return (
                      <tr key={r.user.id} className="row-link" onClick={() => router.push(`/farms/${r.user.id}`)}>
                        <td>
                          <Link href={`/farms/${r.user.id}`} className="cell-main" onClick={e => e.stopPropagation()}>
                            {r.user.full_name}
                          </Link>
                          <span className="cell-sub">
                            {r.user.username}
                            {r.user.phone ? ` · ${r.user.phone}` : ""}
                          </span>
                        </td>
                        <td>
                          <span className="cell-main">{r.area}</span>
                          <span className="cell-sub">{r.user.region?.split(",")[0] ?? "—"}</span>
                        </td>
                        <td className="nowrap">
                          {r.plots.length > 0 ? (
                            <>
                              <span className="cell-main">{r.plots.length} lô</span>
                              <span className="cell-sub">{formatArea(r.areaM2)}</span>
                            </>
                          ) : (
                            <Pill tone="amber">Chưa có lô</Pill>
                          )}
                        </td>
                        <td>{r.crops.length ? r.crops.join(", ") : <span className="muted">—</span>}</td>
                        <td className="num">
                          {r.hasActivity ? (
                            <>
                              <span className={profit < 0 ? "cell-main neg" : "cell-main pos"}>
                                {profit < 0 ? "−" : "+"}
                                {formatVnd(Math.abs(profit))}
                              </span>
                              <span className="cell-sub">
                                Thu {formatVnd(r.income)} · Chi {formatVnd(r.expense)}
                              </span>
                            </>
                          ) : (
                            <span className="muted">Không phát sinh</span>
                          )}
                        </td>
                        <td>
                          <Pill tone={r.user.is_active ? "green" : "gray"}>{r.user.is_active ? "Đang hoạt động" : "Đã khoá"}</Pill>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pager {...paged} onPage={paged.setPage} noun="nông hộ" />
          </>
        )}
      </Panel>
    </>
  );
}
