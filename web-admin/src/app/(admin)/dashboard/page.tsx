"use client";

/**
 * /dashboard
 *
 * Quản trị viên: Tổng quan toàn hệ thống — số nông hộ, lô đất, thu – chi sáu
 * tháng, cơ cấu cây trồng theo diện tích, nông hộ hoạt động và các việc cần xử
 * lý. Mọi con số do `GET /admin/overview` tính một lần ở máy chủ.
 *
 * Nông hộ: sổ sách của chính mình (cùng ba con số với màn hình chính điện thoại).
 */

import Link from "next/link";
import {useEffect, useMemo, useState} from "react";

import {FarmView} from "@/components/admin/FarmView";
import {MonthlyBars, ShareBars} from "@/components/admin/Charts";
import {useAdmin} from "@/components/admin/Shell";
import {EmptyState, Kpi, Notice, PageHeader, Panel, TableSkeleton, type Tone} from "@/components/admin/ui";
import {Icon, type IconName} from "@/components/admin/Icon";
import {api, formatVnd} from "@/lib/api";
import {compactVnd, cropLabel, formatArea, formatDateTime} from "@/lib/format";

interface Overview {
  generated_at: number;
  year: number;
  month: number;
  farmers: {total: number; active: number; locked: number; without_plot: number};
  plots: {
    total: number;
    area_m2: number;
    by_status: Record<string, number>;
    by_crop: {crop_type: string; crop_name: string; plots: number; area_m2: number}[];
  };
  months: {year: number; month: number; income: number; expense: number}[];
  farms: {owner_id: string; income: number; expense: number}[];
  stock_value: number;
  stock_kg: number;
  pending_varieties: number;
  errors_30d: number;
}

interface UserRow {
  id: string;
  username: string;
  full_name: string;
  region: string | null;
  role: string;
  is_active: boolean;
}

export default function DashboardPage() {
  const {me, isAdmin} = useAdmin();
  if (!isAdmin) {
    return (
      <>
        <PageHeader title={`Xin chào, ${me.full_name}`} subtitle={me.region ?? "Sổ sách của tôi"} />
        <FarmView ownerId={me.id} />
      </>
    );
  }
  return <SystemOverview />;
}

const today = new Date();

function SystemOverview() {
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [data, setData] = useState<Overview | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api<Overview>(`/admin/overview?year=${year}&month=${month}&months=6`), api<UserRow[]>("/users")])
      .then(([o, u]) => {
        if (cancelled) return;
        setData(o);
        setUsers(u);
        setError(null);
      })
      .catch(e => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [year, month]);

  const names = useMemo(() => new Map(users.map(u => [u.id, u])), [users]);

  const series = useMemo(
    () =>
      (data?.months ?? []).map(m => ({
        label: `T${m.month}${m.month === 1 || m === data?.months[0] ? `/${String(m.year).slice(2)}` : ""}`,
        income: m.income,
        expense: m.expense,
      })),
    [data],
  );

  const current = data?.months[data.months.length - 1];
  const profit = current ? current.income - current.expense : 0;

  const topFarms = useMemo(
    () =>
      (data?.farms ?? [])
        .map(f => ({...f, profit: f.income - f.expense, user: names.get(f.owner_id)}))
        .sort((a, b) => b.income - a.income)
        .slice(0, 6),
    [data, names],
  );

  const attention: {key: string; count: number; title: string; hint: string; href?: string; tone: Tone}[] = data
    ? [
        {
          key: "varieties",
          count: data.pending_varieties,
          title: "Giống cây chờ duyệt",
          hint: data.pending_varieties ? "Nông hộ đề xuất giống riêng, cần quản trị viên duyệt" : "Không có đề xuất nào đang chờ",
          href: "/varieties",
          tone: data.pending_varieties ? "amber" : "green",
        },
        {
          key: "errors",
          count: data.errors_30d,
          title: "Lỗi từ ứng dụng trong 30 ngày",
          hint: data.errors_30d ? "Điện thoại tự gửi lên khi gặp lỗi hoặc khi nông hộ bấm “Báo lỗi”" : "Chưa có lỗi nào được báo",
          href: "/logs",
          tone: data.errors_30d ? "red" : "green",
        },
        {
          key: "no-plot",
          count: data.farmers.without_plot,
          title: "Nông hộ chưa được giao lô",
          hint: data.farmers.without_plot ? "Tài khoản đã có nhưng chưa có lô đất để ghi chép" : "Mọi nông hộ đều đã có lô",
          href: "/plots",
          tone: data.farmers.without_plot ? "amber" : "green",
        },
        {
          key: "locked",
          count: data.farmers.locked,
          title: "Tài khoản đang bị khoá",
          hint: "Không đăng nhập được cho tới khi quản trị viên mở khoá",
          href: "/accounts",
          tone: data.farmers.locked ? "gray" : "green",
        },
      ]
    : [];

  const monthOptions = Array.from({length: 12}, (_, i) => i + 1);
  const yearOptions = [today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1];

  return (
    <>
      <PageHeader
        title="Tổng quan hệ thống"
        subtitle={data ? `Số liệu tháng ${data.month}/${data.year} · cập nhật lúc ${formatDateTime(data.generated_at)}` : "Đang tải số liệu…"}
        actions={
          <>
            <select className="compact" value={month} onChange={e => setMonth(Number(e.target.value))} aria-label="Tháng">
              {monthOptions.map(m => (
                <option key={m} value={m}>
                  Tháng {m}
                </option>
              ))}
            </select>
            <select className="compact" value={year} onChange={e => setYear(Number(e.target.value))} aria-label="Năm">
              {yearOptions.map(y => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </>
        }
      />

      {error ? <Notice>{error}</Notice> : null}

      <section className="grid grid-kpi" aria-label="Chỉ số chính">
        <Kpi
          label="Nông hộ"
          icon="farms"
          value={data ? data.farmers.total : "—"}
          hint={data ? `${data.farmers.active} đang hoạt động · ${data.farmers.locked} bị khoá` : undefined}
        />
        <Kpi
          label="Lô đất"
          icon="plots"
          tone="blue"
          value={data ? data.plots.total : "—"}
          hint={data ? `Tổng diện tích ${formatArea(data.plots.area_m2)}` : undefined}
        />
        <Kpi
          label={`Lãi/Lỗ tháng ${month}`}
          icon="wallet"
          tone={profit < 0 ? "red" : "green"}
          negative={profit < 0}
          value={data ? `${profit < 0 ? "−" : "+"}${compactVnd(Math.abs(profit), true)}` : "—"}
          hint={current ? `Thu ${formatVnd(current.income)} · Chi ${formatVnd(current.expense)}` : undefined}
        />
        <Kpi
          label="Giá trị tồn kho"
          icon="warehouse"
          tone="amber"
          value={data ? compactVnd(data.stock_value, true) : "—"}
          hint={data ? `${new Intl.NumberFormat("vi-VN").format(data.stock_kg)} kg phân bón` : undefined}
        />
      </section>

      <section className="grid grid-7-5">
        <Panel title="Thu – chi sáu tháng gần nhất" subtitle="Cộng dồn tất cả nông hộ, theo ngày phát sinh do nông hộ nhập">
          {data ? <MonthlyBars data={series} /> : <TableSkeleton rows={5} cols={1} />}
        </Panel>
        <Panel title="Cơ cấu cây trồng" subtitle="Theo diện tích lô đang quản lý">
          {!data ? (
            <TableSkeleton rows={5} cols={1} />
          ) : data.plots.by_crop.length === 0 ? (
            <EmptyState icon="plots" title="Chưa có lô đất nào" hint="Tạo lô ở mục Lô đất rồi giao cho nông hộ." />
          ) : (
            <ShareBars items={data.plots.by_crop.map(c => ({key: c.crop_type, label: cropLabel(c.crop_type, c.crop_name), area_m2: c.area_m2, plots: c.plots}))} />
          )}
        </Panel>
      </section>

      <section className="grid grid-7-5">
        <Panel title={`Nông hộ có phát sinh trong tháng ${month}`} subtitle="Xếp theo doanh thu giảm dần" flush>
          {!data ? (
            <TableSkeleton rows={5} cols={4} />
          ) : topFarms.length === 0 ? (
            <EmptyState icon="wallet" title="Tháng này chưa có khoản thu – chi nào" hint="Chọn tháng khác ở góc trên bên phải." />
          ) : (
            <div className="data-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nông hộ</th>
                    <th className="num">Thu</th>
                    <th className="num">Chi</th>
                    <th className="num">Lãi/Lỗ</th>
                  </tr>
                </thead>
                <tbody>
                  {topFarms.map(f => (
                    <tr key={f.owner_id}>
                      <td>
                        <Link href={`/farms/${f.owner_id}`} className="cell-main">
                          {f.user?.full_name ?? f.owner_id}
                        </Link>
                        <span className="cell-sub">{f.user?.region ?? "—"}</span>
                      </td>
                      <td className="num">{formatVnd(f.income)}</td>
                      <td className="num">{formatVnd(f.expense)}</td>
                      <td className={f.profit < 0 ? "num neg" : "num pos"}>{formatVnd(f.profit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Cần xử lý" flush>
          {!data ? (
            <TableSkeleton rows={4} cols={1} />
          ) : (
            <ul className="attention-list">
              {attention.map(item => {
                const body = (
                  <>
                    <span className={`attention-count tone-${item.tone}`}>{item.count}</span>
                    <span className="attention-text">
                      <strong>{item.title}</strong>
                      <span>{item.hint}</span>
                    </span>
                    {item.href ? <Icon name={"chevronRight" as IconName} size={16} /> : null}
                  </>
                );
                return (
                  <li key={item.key}>
                    {item.href ? (
                      <Link href={item.href} className="attention-item">
                        {body}
                      </Link>
                    ) : (
                      <div className="attention-item">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </section>
    </>
  );
}
