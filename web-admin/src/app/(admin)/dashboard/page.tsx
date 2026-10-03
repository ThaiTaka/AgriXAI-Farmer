"use client";

/**
 * Tổng quan — the admin's home: every farm of the village at once.
 *
 * Four figures (farms, land, this month's money, stock), money in and out
 * across all farms for six months, the village forecast, what is planted on
 * how much land, the last messages sent and whether farms opened them, and a
 * table of farms with their own figures and when each last showed activity.
 */

import Link from "next/link";
import {useEffect, useState} from "react";

import {DonutChart, GroupedBarChart} from "@/components/charts";
import {
  IconAlert,
  IconBell,
  IconChevronRight,
  IconCoins,
  IconFarms,
  IconPlots,
  IconSprout,
  IconTasks,
  IconWarehouse,
} from "@/components/icons";
import {useAdmin} from "@/components/AdminShell";
import {EmptyState, Meter, PageHeader, Panel, Pill, Skeleton, StatCard} from "@/components/ui";
import {WeatherGlyph} from "@/components/WeatherGlyph";
import {api, formatVnd} from "@/lib/api";
import {dayLabel, formatArea, formatNumber, formatVndCompact, longDate, MONTHS_SHORT, timeAgo} from "@/lib/format";
import type {AppNotice, Overview} from "@/lib/types";

const KIND_LABEL: Record<string, string> = {announcement: "Ban quản lý", weather: "Thời tiết", price: "Giá phân bón"};

export default function OverviewPage() {
  const {forecast} = useAdmin();
  const [data, setData] = useState<Overview | null>(null);
  const [notices, setNotices] = useState<AppNotice[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Overview>("/dashboard/overview")
      .then(setData)
      .catch(e => setError(e instanceof Error ? e.message : String(e)));
    api<AppNotice[]>("/notifications?limit=5")
      .then(setNotices)
      .catch(() => setNotices([]));
  }, []);

  const profit = data ? data.month_income - data.month_expense : 0;
  const prev = data?.months[data.months.length - 2];

  return (
    <main className="page">
      <PageHeader
        title="Tổng quan"
        subtitle={`${longDate()} · số liệu của mọi nông hộ làng hoa Vạn Thành, đọc trực tiếp từ máy chủ.`}
        actions={
          <>
            <Link href="/notifications" className="btn btn-secondary">
              <IconBell size={18} /> Gửi thông báo
            </Link>
            <Link href="/plots" className="btn btn-primary">
              <IconPlots size={18} /> Quản lý lô đất
            </Link>
          </>
        }
      />

      {error ? <p className="error">Không tải được số liệu tổng quan: {error}</p> : null}

      <div className="grid grid-kpi">
        <StatCard
          label="Nông hộ"
          tone="green"
          icon={<IconFarms size={22} />}
          value={data ? formatNumber(data.farms_total) : <Skeleton height={28} width={60} />}
          sub={data ? `${data.farms_active} đang hoạt động` : null}
        />
        <StatCard
          label="Đất canh tác"
          tone="lime"
          icon={<IconPlots size={22} />}
          value={data ? formatArea(data.area_m2) : <Skeleton height={28} width={110} />}
          sub={data ? `${data.plots} lô · ${data.crops.length} loại cây đang trồng` : null}
        />
        <StatCard
          label={data ? `Lãi tháng ${data.month}/${data.year}` : "Lãi tháng này"}
          tone={profit < 0 ? "coral" : "amber"}
          icon={<IconCoins size={22} />}
          value={data ? <span className={profit < 0 ? "down" : undefined}>{formatVnd(profit)}</span> : <Skeleton height={28} width={130} />}
          sub={data ? `Thu ${formatVndCompact(data.month_income)} · Chi ${formatVndCompact(data.month_expense)}` : null}
        />
        <StatCard
          label="Tồn kho phân bón"
          tone="blue"
          icon={<IconWarehouse size={22} />}
          value={data ? formatVnd(data.stock_value) : <Skeleton height={28} width={130} />}
          sub={data ? "Giá trị theo giá nhập (FIFO), mọi nông hộ" : null}
        />
      </div>

      <div className="grid grid-main">
        <Panel
          title="Thu – chi 6 tháng gần nhất"
          subtitle="Tổng của mọi nông hộ, theo ngày phát sinh trên sổ."
          action={
            prev ? (
              <span className="text-sm text-muted">
                Tháng {prev.month}: thu {formatVndCompact(prev.income)} · chi {formatVndCompact(prev.expense)}
              </span>
            ) : null
          }>
          {data ? (
            <GroupedBarChart
              data={data.months.map(m => ({label: `${MONTHS_SHORT[m.month - 1]}/${String(m.year).slice(2)}`, values: [m.income, m.expense]}))}
              series={[
                {name: "Thu", color: "#2E6F40"},
                {name: "Chi", color: "#E9725F"},
              ]}
            />
          ) : (
            <Skeleton height={260} />
          )}
        </Panel>

        <Panel
          title="Thời tiết làng hoa"
          subtitle={forecast ? `${forecast.source.name} · ${timeAgo(forecast.fetched_at)}` : "Open-Meteo"}
          action={
            <Link href="/weather" className="btn btn-ghost btn-sm">
              Chi tiết <IconChevronRight size={16} />
            </Link>
          }>
          {forecast ? (
            <div>
              <div className="weather-hero">
                <WeatherGlyph icon={forecast.current.icon} night={!forecast.current.is_day} size={64} />
                <div>
                  <div className="weather-temp">{forecast.current.temperature != null ? `${Math.round(forecast.current.temperature)}°` : "–"}</div>
                  <div className="text-muted" style={{fontWeight: 700, marginTop: 4}}>
                    {forecast.current.summary}
                  </div>
                </div>
              </div>
              {forecast.alerts.length > 0 ? (
                <div className={`alert-box ${forecast.alerts[0].level}`} style={{marginTop: 14}}>
                  <IconAlert size={20} />
                  <div>
                    <div className="alert-title">{forecast.alerts[0].title}</div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted" style={{marginTop: 12}}>
                  Không có cảnh báo mưa to, rét hại cho 3 ngày tới (ngưỡng QĐ 18/2021/QĐ-TTg).
                </p>
              )}
              <div className="list list-bleed" style={{marginTop: 12}}>
                {forecast.daily.slice(1, 4).map(d => (
                  <div key={d.date} className="list-row" style={{paddingBlock: 9}}>
                    <WeatherGlyph icon={d.icon} size={28} />
                    <div className="list-row-main">
                      <div className="list-row-title">{dayLabel(d.date)}</div>
                      <div className="list-row-sub">{d.summary}</div>
                    </div>
                    <div className="text-sm tabular" style={{textAlign: "right"}}>
                      <div style={{fontWeight: 700}}>
                        {d.temp_min != null ? Math.round(d.temp_min) : "–"}°–{d.temp_max != null ? Math.round(d.temp_max) : "–"}°
                      </div>
                      <div className="text-muted">{d.precipitation_sum != null ? `${d.precipitation_sum.toLocaleString("vi-VN")} mm` : "–"}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <Skeleton height={220} />
          )}
        </Panel>
      </div>

      <div className="grid grid-halves">
        <Panel title="Cơ cấu cây trồng" subtitle="Diện tích lô đang canh tác, theo loại cây.">
          {data ? (
            data.crops.length > 0 ? (
              <DonutChart
                data={data.crops.map(c => ({label: `${c.crop_name} (${c.plots} lô)`, value: c.area_m2}))}
                centerValue={formatArea(data.crops.reduce((s, c) => s + c.area_m2, 0))}
                centerLabel="đang canh tác"
                format={formatArea}
              />
            ) : (
              <EmptyState icon={<IconSprout />} title="Chưa có lô đang canh tác" body="Tạo lô và giao cho nông hộ ở trang Lô đất." />
            )
          ) : (
            <Skeleton height={200} />
          )}
        </Panel>

        <Panel
          title="Thông báo gần đây"
          subtitle="Bao nhiêu nông hộ đã mở trên điện thoại."
          action={
            <Link href="/notifications" className="btn btn-ghost btn-sm">
              Tất cả <IconChevronRight size={16} />
            </Link>
          }
          flush>
          {notices == null ? (
            <div className="panel-body">
              <Skeleton height={160} />
            </div>
          ) : notices.length === 0 ? (
            <EmptyState icon={<IconBell />} title="Chưa gửi thông báo nào" body="Tin của ban quản lý, cảnh báo thời tiết và giá phân mới sẽ hiện ở đây." />
          ) : (
            <div className="list">
              {notices.map(n => (
                <div key={n.id} className="list-row">
                  <span className="dot" style={{background: n.level === "danger" ? "#e9725f" : n.level === "warning" ? "#f5a524" : "#54a96a"}} />
                  <div className="list-row-main">
                    <div className="list-row-title">{n.title}</div>
                    <div className="list-row-sub">
                      {KIND_LABEL[n.kind] ?? "Thông báo"} · {n.audience_label} · {timeAgo(n.created_at)}
                    </div>
                  </div>
                  <div style={{width: 120}}>
                    <div className="text-sm tabular" style={{textAlign: "right", fontWeight: 700}}>
                      {n.read_count ?? 0}/{n.audience_size ?? 0} đã xem
                    </div>
                    <Meter value={n.read_count ?? 0} max={n.audience_size ?? 0} label="Tỷ lệ đã xem" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel
        title="Nông hộ"
        subtitle="Số liệu tháng này của từng hộ — giống hệt dashboard trên điện thoại của họ."
        action={
          data ? (
            <div className="row row-wrap">
              {data.varieties_pending > 0 ? (
                <Link href="/varieties">
                  <Pill tone="amber">{data.varieties_pending} giống chờ duyệt</Pill>
                </Link>
              ) : null}
              {data.errors_7d > 0 ? (
                <Link href="/logs">
                  <Pill tone="red">{data.errors_7d} lỗi 7 ngày qua</Pill>
                </Link>
              ) : (
                <Pill tone="green">Không có lỗi 7 ngày qua</Pill>
              )}
              <Pill tone="blue">
                <IconTasks size={14} /> {data.pending_tasks} việc chăm sóc đang chờ
              </Pill>
            </div>
          ) : null
        }
        flush>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Nông hộ</th>
                <th className="num">Lô</th>
                <th className="num">Diện tích</th>
                <th className="num">Thu tháng</th>
                <th className="num">Chi tháng</th>
                <th className="num">Tồn kho</th>
                <th className="num">Việc chờ</th>
                <th>Hoạt động gần nhất</th>
                <th aria-label="Mở" />
              </tr>
            </thead>
            <tbody>
              {data == null
                ? [0, 1, 2].map(i => (
                    <tr key={i}>
                      <td colSpan={9}>
                        <Skeleton height={20} />
                      </td>
                    </tr>
                  ))
                : data.farms.map(f => (
                    <tr key={f.id}>
                      <td>
                        <div className="cell-main">{f.full_name}</div>
                        <div className="cell-sub">
                          {f.username}
                          {f.region ? ` · ${f.region}` : ""}
                          {!f.is_active ? " · đã khoá" : ""}
                        </div>
                      </td>
                      <td className="num">{f.plots}</td>
                      <td className="num">{formatArea(f.area_m2)}</td>
                      <td className="num">{formatVnd(f.month_income)}</td>
                      <td className="num">{formatVnd(f.month_expense)}</td>
                      <td className="num">{formatVnd(f.stock_value)}</td>
                      <td className="num">{f.pending_tasks > 0 ? <Pill tone="amber">{f.pending_tasks}</Pill> : "0"}</td>
                      <td>{f.last_activity ? timeAgo(f.last_activity) : <span className="text-muted">Chưa có dữ liệu</span>}</td>
                      <td>
                        <Link className="btn btn-ghost btn-sm" href={`/farms?owner=${encodeURIComponent(f.id)}`}>
                          Sổ sách <IconChevronRight size={16} />
                        </Link>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </main>
  );
}
