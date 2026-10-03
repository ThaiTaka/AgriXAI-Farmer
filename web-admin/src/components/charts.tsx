"use client";

/**
 * Small SVG charts drawn by hand — no chart library, so the admin stays light
 * and works on a LAN without the internet. Each chart also carries the
 * numbers as text (titles, legend, table) for screen readers.
 */

import {useEffect, useRef, useState} from "react";

import {formatVndCompact} from "@/lib/format";

/** A round step (1, 2, 2.5 or 5 × 10ⁿ) at least as big as `value`. */
function niceStep(value: number): number {
  if (value <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (value <= step * exp) return step * exp;
  }
  return 10 * exp;
}

/** Axis ticks with round values: about five steps from 0 to just above `max`. */
export function axisTicks(max: number): number[] {
  const step = niceStep(Math.max(max, 1) / 5);
  const count = Math.max(1, Math.ceil(Math.max(max, 1) / step));
  return Array.from({length: count + 1}, (_, i) => i * step);
}

export interface BarDatum {
  label: string;
  values: number[];
}

export function GroupedBarChart({
  data,
  series,
  height = 260,
  format = formatVndCompact,
}: {
  data: BarDatum[];
  series: {name: string; color: string}[];
  height?: number;
  format?: (v: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  // Drawn at the box's real width, so axis text stays 12 px on a phone too.
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.round(entry.contentRect.width))));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const narrow = width < 480;
  const pad = {top: 16, right: 8, bottom: 34, left: narrow ? 46 : 64};
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const ticks = axisTicks(Math.max(0, ...data.flatMap(d => d.values)));
  const max = ticks[ticks.length - 1];
  const band = innerW / Math.max(1, data.length);
  const groupW = Math.min(64, band * (narrow ? 0.72 : 0.62));
  const barW = groupW / series.length;
  const y = (v: number) => pad.top + innerH - (v / max) * innerH;

  return (
    <div className="chart" ref={box}>
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" role="img" aria-label="Biểu đồ cột">
        {ticks.map(t => (
          <g key={t}>
            <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} className="chart-grid" />
            <text x={pad.left - 10} y={y(t)} className="chart-axis" textAnchor="end" dominantBaseline="middle">
              {format(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x0 = pad.left + band * i + (band - groupW) / 2;
          return (
            <g key={d.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={pad.left + band * i} y={pad.top} width={band} height={innerH} className={hover === i ? "chart-hoverband on" : "chart-hoverband"} />
              {d.values.map((v, s) => {
                const h = Math.max(v > 0 ? 2 : 0, (v / max) * innerH);
                // 2 px of surface between neighbouring bars; only the data end is rounded.
                return (
                  <path key={s} d={topRoundedBar(x0 + s * barW + 1, pad.top + innerH - h, barW - 2, h, 4)} fill={series[s].color}>
                    <title>{`${d.label} · ${series[s].name}: ${format(v)}`}</title>
                  </path>
                );
              })}
              <text x={pad.left + band * i + band / 2} y={height - 12} className="chart-axis" textAnchor="middle">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="chart-legend">
        {series.map(s => (
          <span key={s.name}>
            <i style={{background: s.color}} />
            {s.name}
          </span>
        ))}
        {hover != null ? (
          <span className="chart-readout">
            {data[hover].label}: {data[hover].values.map((v, s) => `${series[s].name} ${format(v)}`).join(" · ")}
          </span>
        ) : (
          <button type="button" className="link-btn chart-readout" onClick={() => setAsTable(t => !t)} aria-expanded={asTable}>
            {asTable ? "Ẩn bảng số liệu" : "Xem bảng số liệu"}
          </button>
        )}
      </div>
      {asTable ? (
        <div className="table-wrap" style={{marginTop: 10}}>
          <table className="table">
            <thead>
              <tr>
                <th>Kỳ</th>
                {series.map(s => (
                  <th key={s.name} className="num">
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map(d => (
                <tr key={d.label}>
                  <td>{d.label}</td>
                  {d.values.map((v, i) => (
                    <td key={i} className="num">
                      {v.toLocaleString("vi-VN")}₫
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

/** A bar rounded at its data end only, square on the baseline. */
function topRoundedBar(x: number, y: number, w: number, h: number, r: number): string {
  if (h <= 0 || w <= 0) return "";
  const rr = Math.min(r, w / 2, h);
  return `M${x} ${y + h}V${y + rr}Q${x} ${y} ${x + rr} ${y}H${x + w - rr}Q${x + w} ${y} ${x + w} ${y + rr}V${y + h}Z`;
}

/**
 * Categorical slots, in a fixed order checked with the dataviz validator
 * (lightness band, chroma, colour-blind separation of neighbours). Never
 * cycled: a ninth category folds into "Khác".
 */
export const CHART_PALETTE = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
const OTHER_COLOR = "#9aa39d";

/** Keeps the first slots, folds the rest into one "Khác" entry. */
function foldTail(data: {label: string; value: number}[]): {label: string; value: number; color: string}[] {
  if (data.length <= CHART_PALETTE.length) return data.map((d, i) => ({...d, color: CHART_PALETTE[i]}));
  const head = data.slice(0, CHART_PALETTE.length - 1).map((d, i) => ({...d, color: CHART_PALETTE[i]}));
  const rest = data.slice(CHART_PALETTE.length - 1).reduce((sum, d) => sum + d.value, 0);
  return [...head, {label: "Khác", value: rest, color: OTHER_COLOR}];
}

export function DonutChart({
  data,
  centerLabel,
  centerValue,
  format,
}: {
  data: {label: string; value: number}[];
  centerLabel: string;
  centerValue: string;
  format: (v: number) => string;
}) {
  const slots = foldTail(data);
  const total = slots.reduce((s, d) => s + d.value, 0);
  const r = 70;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="donut">
      <svg viewBox="0 0 200 200" className="donut-svg" role="img" aria-label={centerLabel}>
        <circle cx={100} cy={100} r={r} fill="none" stroke="#EEF2EE" strokeWidth={26} />
        {total > 0
          ? slots.map(d => {
              const len = (d.value / total) * c;
              const seg = (
                <circle
                  key={d.label}
                  cx={100}
                  cy={100}
                  r={r}
                  fill="none"
                  stroke={d.color}
                  strokeWidth={26}
                  strokeDasharray={`${Math.max(0, len - 2)} ${c - Math.max(0, len - 2)}`}
                  strokeDashoffset={-offset}
                  transform="rotate(-90 100 100)">
                  <title>{`${d.label}: ${format(d.value)} (${Math.round((d.value / total) * 100)}%)`}</title>
                </circle>
              );
              offset += len;
              return seg;
            })
          : null}
        <text x={100} y={94} textAnchor="middle" className="donut-value">
          {centerValue}
        </text>
        <text x={100} y={116} textAnchor="middle" className="donut-label">
          {centerLabel}
        </text>
      </svg>
      <ul className="donut-legend">
        {slots.map(d => (
          <li key={d.label}>
            <i style={{background: d.color}} />
            <span className="donut-legend-label">{d.label}</span>
            <span className="donut-legend-value">
              {format(d.value)} · {total > 0 ? Math.round((d.value / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One day's temperature span on a shared scale, like the phone's forecast. */
export function TempRange({min, max, low, high}: {min: number | null; max: number | null; low: number; high: number}) {
  const span = Math.max(1, high - low);
  const from = min == null ? 0 : ((min - low) / span) * 100;
  const to = max == null ? 100 : ((max - low) / span) * 100;
  return (
    <span className="temp-range">
      <span className="temp-range-fill" style={{left: `${from}%`, right: `${100 - to}%`}} />
    </span>
  );
}
