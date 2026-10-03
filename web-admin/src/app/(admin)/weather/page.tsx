"use client";

/**
 * Thời tiết — the forecast the phones show for Làng hoa Vạn Thành, and the
 * official warnings the server raises from it.
 *
 * Source: Open-Meteo (CC BY 4.0), fetched by the server every 30 minutes for
 * the whole village. Warnings follow QĐ 18/2021/QĐ-TTg, Điều 5: mưa to above
 * 50 to 100 mm in 24 h, mưa rất to above 100 mm (khoản 17); rét hại when the
 * daily mean drops below 13 °C (khoản 18). "Làm mới" fetches at once and turns
 * any new warning into a notification for every farm.
 */

import {useMemo, useState} from "react";

import {useAdmin} from "@/components/AdminShell";
import {TempRange} from "@/components/charts";
import {IconAlert, IconDroplet, IconExternal, IconRefresh, IconWind} from "@/components/icons";
import {EmptyState, PageHeader, Panel, Pill, Skeleton, Toast} from "@/components/ui";
import {WeatherGlyph} from "@/components/WeatherGlyph";
import {api} from "@/lib/api";
import {dayLabel, formatDateTime, timeAgo} from "@/lib/format";
import type {Forecast} from "@/lib/types";

const OFFICIAL = "https://www.nchmf.gov.vn/kttv/";

export default function WeatherPage() {
  const {forecast, setForecast} = useAdmin();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const range = useMemo(() => {
    const days = forecast?.daily ?? [];
    return {
      low: Math.min(...days.map(d => d.temp_min ?? Infinity)),
      high: Math.max(...days.map(d => d.temp_max ?? -Infinity)),
      wettest: Math.max(1, ...days.map(d => d.precipitation_sum ?? 0)),
    };
  }, [forecast]);

  const refresh = async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await api<Forecast>("/weather/refresh", {method: "POST"});
      setForecast(data);
      const raised = data.raised?.length ?? 0;
      setToast(raised > 0 ? `Đã cập nhật dự báo — gửi ${raised} cảnh báo mới tới mọi nông hộ` : "Đã cập nhật dự báo — không có cảnh báo mới");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="page">
      <PageHeader
        title="Thời tiết"
        subtitle={forecast ? `${forecast.place} · ${forecast.latitude.toFixed(4)}° B, ${forecast.longitude.toFixed(4)}° Đ · ô lưới ${forecast.elevation ?? "–"} m` : "Làng hoa Vạn Thành, Đà Lạt"}
        actions={
          <button className="btn btn-primary" onClick={refresh} disabled={busy}>
            <IconRefresh size={18} /> {busy ? "Đang cập nhật…" : "Làm mới ngay"}
          </button>
        }
      />
      {error ? <p className="error">{error}</p> : null}

      {!forecast ? (
        <Panel>
          <Skeleton height={240} />
        </Panel>
      ) : (
        <>
          <div className="grid grid-main">
            <Panel title="Hiện tại" subtitle={`${forecast.source.name} · cập nhật ${timeAgo(forecast.fetched_at)}${forecast.stale ? " · đang dùng bản cũ (chưa lấy được bản mới)" : ""}`}>
              <div className="weather-hero">
                <WeatherGlyph icon={forecast.current.icon} night={!forecast.current.is_day} size={96} />
                <div>
                  <div className="weather-temp" style={{fontSize: 64}}>
                    {forecast.current.temperature != null ? `${Math.round(forecast.current.temperature)}°` : "–"}
                  </div>
                  <div style={{fontWeight: 800, fontSize: 18, marginTop: 6}}>{forecast.current.summary}</div>
                </div>
              </div>
              <div className="weather-facts">
                <div className="weather-fact">
                  <IconDroplet size={20} />
                  <div>
                    Độ ẩm<strong>{forecast.current.humidity != null ? `${forecast.current.humidity}%` : "–"}</strong>
                  </div>
                </div>
                <div className="weather-fact">
                  <IconWind size={20} />
                  <div>
                    Gió<strong>{forecast.current.wind_speed != null ? `${Math.round(forecast.current.wind_speed)} km/h` : "–"}</strong>
                  </div>
                </div>
                <div className="weather-fact">
                  <IconDroplet size={20} />
                  <div>
                    Mưa lúc này<strong>{forecast.current.precipitation != null ? `${forecast.current.precipitation.toLocaleString("vi-VN")} mm` : "–"}</strong>
                  </div>
                </div>
              </div>
            </Panel>

            <Panel title="Cảnh báo" subtitle="Hôm nay và 2 ngày tới, theo ngưỡng của QĐ 18/2021/QĐ-TTg.">
              {forecast.alerts.length === 0 ? (
                <EmptyState icon={<IconAlert />} title="Không có cảnh báo" body="Dự báo chưa có ngày nào mưa trên 50 mm hay nhiệt độ trung bình dưới 13 °C." />
              ) : (
                <div className="list" style={{gap: 10}}>
                  {forecast.alerts.map(a => (
                    <div key={a.id} className={`alert-box ${a.level}`}>
                      <IconAlert size={20} />
                      <div>
                        <div className="alert-title">{a.title}</div>
                        <div className="alert-body">{a.body}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>

          <Panel title="7 ngày tới" subtitle="Nhiệt độ thấp – cao, tổng lượng mưa trong ngày và khả năng mưa." flush>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Ngày</th>
                    <th>Thời tiết</th>
                    <th className="num">Thấp</th>
                    <th style={{width: "28%"}}>Khoảng nhiệt độ</th>
                    <th className="num">Cao</th>
                    <th className="num">Lượng mưa</th>
                    <th className="num">Khả năng mưa</th>
                    <th className="num">Gió tối đa</th>
                  </tr>
                </thead>
                <tbody>
                  {forecast.daily.map(d => {
                    const rain = d.precipitation_sum ?? 0;
                    return (
                      <tr key={d.date}>
                        <td className="cell-main">{dayLabel(d.date)}</td>
                        <td>
                          <span className="row" style={{gap: 8}}>
                            <WeatherGlyph icon={d.icon} size={30} />
                            {d.summary}
                          </span>
                        </td>
                        <td className="num">{d.temp_min != null ? `${Math.round(d.temp_min)}°` : "–"}</td>
                        <td>
                          <TempRange min={d.temp_min} max={d.temp_max} low={range.low} high={range.high} />
                        </td>
                        <td className="num">{d.temp_max != null ? `${Math.round(d.temp_max)}°` : "–"}</td>
                        <td className="num">
                          <span className="row" style={{justifyContent: "flex-end", gap: 8}}>
                            <span className="meter" style={{width: 70, minWidth: 70}}>
                              <span className="meter-fill tone-bg-blue" style={{width: `${Math.round((rain / range.wettest) * 100)}%`}} />
                            </span>
                            {rain.toLocaleString("vi-VN")} mm
                            {rain > 50 ? <Pill tone="red">mưa to</Pill> : null}
                          </span>
                        </td>
                        <td className="num">{d.precipitation_probability != null ? `${d.precipitation_probability}%` : "–"}</td>
                        <td className="num">{d.wind_speed_max != null ? `${Math.round(d.wind_speed_max)} km/h` : "–"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Nguồn và cách cảnh báo">
            <div className="grid grid-halves" style={{gap: 22}}>
              <div>
                <p className="text-sm" style={{lineHeight: 1.6}}>
                  Dự báo theo mô hình của <strong>{forecast.source.name}</strong> ({forecast.source.licence}) cho một điểm ở làng hoa, máy chủ hỏi 30 phút một lần cho mọi điện thoại. Gói miễn phí dành cho dùng phi thương mại. Đây là dự báo, không phải số đo tại vườn. Lần lấy gần nhất: {formatDateTime(forecast.fetched_at)}.
                </p>
                <a className="btn btn-ghost btn-sm btn-wrap" href={forecast.source.url} target="_blank" rel="noreferrer" style={{marginTop: 8, paddingInline: 0}}>
                  Weather data by Open-Meteo.com <IconExternal size={16} />
                </a>
              </div>
              <div>
                <p className="text-sm" style={{lineHeight: 1.6}}>
                  Cảnh báo theo <strong>{forecast.basis}</strong>: mưa to khi tổng lượng mưa trên 50 đến 100 mm trong 24 giờ, mưa rất to khi trên 100 mm (khoản 17); rét hại khi nhiệt độ trung bình ngày dưới 13 °C (khoản 18). Mỗi cảnh báo chỉ gửi một lần cho mỗi ngày và mỗi mức; thu hồi ở trang Thông báo thì không gửi lại.
                </p>
                <a className="btn btn-ghost btn-sm btn-wrap" href={OFFICIAL} target="_blank" rel="noreferrer" style={{marginTop: 8, paddingInline: 0}}>
                  Bản tin chính thức — Trung tâm Dự báo KTTV Quốc gia <IconExternal size={16} />
                </a>
              </div>
            </div>
          </Panel>
        </>
      )}
      {toast ? <Toast message={toast} onDone={() => setToast(null)} /> : null}
    </main>
  );
}
