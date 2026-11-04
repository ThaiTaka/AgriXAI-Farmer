"use client";

/**
 * Hai biểu đồ của trang Tổng quan, vẽ bằng SVG thuần:
 *   - MonthlyBars: thu và chi theo tháng (cột đôi, một trục).
 *   - ShareBars: cơ cấu theo diện tích (thanh ngang).
 *
 * Quy tắc áp dụng: một trục duy nhất; cột bo 4px ở đầu và neo vào đường nền;
 * màu theo thực thể chứ không theo thứ hạng (Thu = xanh thương hiệu, Chi =
 * cam — hai màu này đã qua bộ kiểm tra màu: khoảng cách CVD 9,0 và 29,4 ở thị
 * giác thường); chú giải luôn hiện; có bảng số liệu thay thế cho người không
 * phân biệt được màu hoặc dùng trình đọc màn hình.
 */

import {useState} from "react";

import {compactVnd, formatArea} from "@/lib/format";

export const INCOME_COLOR = "#2E6F40";
export const EXPENSE_COLOR = "#EB6834";

export interface MonthPoint {
  label: string;
  income: number;
  expense: number;
}

const niceMax = (value: number): number => {
  if (value <= 0) return 1_000_000;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    if (value <= step * magnitude) return step * magnitude;
  }
  return 10 * magnitude;
};

const vnd = (value: number) => `${new Intl.NumberFormat("vi-VN", {maximumFractionDigits: 0}).format(value)}₫`;

export function MonthlyBars({data}: {data: MonthPoint[]}) {
  const [table, setTable] = useState(false);
  const [hover, setHover] = useState<number | null>(null);

  const W = 640;
  const H = 290;
  const M = {top: 12, right: 8, bottom: 30, left: 58};
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const max = niceMax(Math.max(0, ...data.flatMap(d => [d.income, d.expense])));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => t * max);
  const group = plotW / Math.max(1, data.length);
  const barW = Math.min(30, group * 0.3);
  const y = (v: number) => M.top + plotH - (v / max) * plotH;

  const hasData = data.some(d => d.income > 0 || d.expense > 0);

  return (
    <div>
      <div className="row-between" style={{marginBottom: 8}}>
        <ul className="chart-legend" style={{margin: 0}}>
          <li>
            <span className="swatch" style={{background: INCOME_COLOR}} /> Thu
          </li>
          <li>
            <span className="swatch" style={{background: EXPENSE_COLOR}} /> Chi
          </li>
        </ul>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setTable(t => !t)} aria-pressed={table}>
          {table ? "Xem biểu đồ" : "Xem bảng số liệu"}
        </button>
      </div>

      {table ? (
        <div className="data-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tháng</th>
                <th className="num">Thu</th>
                <th className="num">Chi</th>
                <th className="num">Lãi/Lỗ</th>
              </tr>
            </thead>
            <tbody>
              {data.map(d => (
                <tr key={d.label}>
                  <td>{d.label}</td>
                  <td className="num">{vnd(d.income)}</td>
                  <td className="num">{vnd(d.expense)}</td>
                  <td className={d.income - d.expense < 0 ? "num neg" : "num pos"}>{vnd(d.income - d.expense)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{position: "relative"}}>
          <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Biểu đồ cột thu và chi theo tháng" onMouseLeave={() => setHover(null)}>
            {ticks.map(t => (
              <g key={t}>
                <line className="grid-line" x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} />
                <text className="axis-label" x={M.left - 8} y={y(t) + 4} textAnchor="end">
                  {compactVnd(t)}
                </text>
              </g>
            ))}
            {data.map((d, i) => {
              const cx = M.left + group * i + group / 2;
              const bars = [
                {v: d.income, x: cx - barW - 1, color: INCOME_COLOR},
                {v: d.expense, x: cx + 1, color: EXPENSE_COLOR},
              ];
              return (
                <g key={d.label} onMouseEnter={() => setHover(i)}>
                  <rect x={M.left + group * i} y={M.top} width={group} height={plotH} fill="transparent" />
                  {bars.map(b => {
                    const h = Math.max(b.v > 0 ? 2 : 0, plotH - (y(b.v) - M.top));
                    const r = Math.min(4, h / 2, barW / 2);
                    // Bo hai góc trên, đáy phẳng neo vào đường nền.
                    const top = M.top + plotH - h;
                    return (
                      <path
                        key={b.color}
                        d={`M${b.x},${M.top + plotH} V${top + r} Q${b.x},${top} ${b.x + r},${top} H${b.x + barW - r} Q${b.x + barW},${top} ${b.x + barW},${top + r} V${M.top + plotH} Z`}
                        fill={b.color}
                        opacity={hover === null || hover === i ? 1 : 0.45}
                      />
                    );
                  })}
                  <text className="axis-label" x={cx} y={H - 10} textAnchor="middle" style={{fontWeight: hover === i ? 700 : 400}}>
                    {d.label}
                  </text>
                </g>
              );
            })}
            <line x1={M.left} x2={W - M.right} y1={M.top + plotH} y2={M.top + plotH} stroke="var(--color-border-strong)" />
          </svg>
          {hover !== null ? (
            <div
              role="tooltip"
              style={{
                position: "absolute",
                top: 8,
                left: `${Math.min(70, Math.max(2, ((M.left + group * hover) / W) * 100))}%`,
                background: "var(--color-surface-card)",
                border: "1px solid var(--color-border-strong)",
                borderRadius: 8,
                padding: "8px 12px",
                boxShadow: "var(--shadow-md)",
                fontSize: 13,
                pointerEvents: "none",
              }}
            >
              <strong>{data[hover].label}</strong>
              <div>Thu: {vnd(data[hover].income)}</div>
              <div>Chi: {vnd(data[hover].expense)}</div>
              <div className={data[hover].income - data[hover].expense < 0 ? "neg" : "pos"}>
                {data[hover].income - data[hover].expense < 0 ? "Lỗ" : "Lãi"}: {vnd(Math.abs(data[hover].income - data[hover].expense))}
              </div>
            </div>
          ) : null}
          {!hasData ? (
            <p className="muted small" style={{textAlign: "center", marginTop: 8}}>
              Chưa có khoản thu – chi nào trong các tháng này.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

export interface ShareItem {
  key: string;
  label: string;
  area_m2: number;
  plots: number;
}

export function ShareBars({items}: {items: ShareItem[]}) {
  const total = items.reduce((s, i) => s + i.area_m2, 0);
  const max = Math.max(1, ...items.map(i => i.area_m2));
  return (
    <ul className="bar-list">
      {items.map(item => (
        <li key={item.key}>
          <div className="bar-row-head">
            <span style={{fontWeight: 600}}>{item.label}</span>
            <span className="muted small">
              {formatArea(item.area_m2)} · {item.plots} lô · {total > 0 ? Math.round((item.area_m2 / total) * 100) : 0}%
            </span>
          </div>
          <div className="bar-track" role="presentation">
            <div className="bar-fill" style={{width: `${(item.area_m2 / max) * 100}%`}} />
          </div>
        </li>
      ))}
    </ul>
  );
}
