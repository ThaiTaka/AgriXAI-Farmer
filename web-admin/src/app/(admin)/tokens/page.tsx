"use client";

/**
 * Hệ thiết kế — the parts every web-admin page is built from, shown live:
 * colours (from shared/design/tokens.json via tokens.css, plus the admin
 * shell's own), the chart palette checked with the dataviz validator, type
 * weights of the bundled Open Sans, and the shared components in ui.tsx.
 * A new page should look like it belongs by using only what is here.
 */

import {useState} from "react";

import {CHART_PALETTE} from "@/components/charts";
import {IconAlert, IconBook, IconCheck, IconFarms, IconPlus} from "@/components/icons";
import {EmptyState, Meter, PageHeader, Panel, Pill, Segmented, StatCard} from "@/components/ui";

const BRAND = [
  {name: "Xanh lá chính", value: "#2E6F40", use: "Nút chính, thu, liên kết"},
  {name: "Xanh lá sáng", value: "#54A96A", use: "Thanh tiến độ, logo"},
  {name: "Vàng chanh", value: "#C3D24A", use: "Điểm nhấn trên nền tối"},
  {name: "Nền thanh bên", value: "#11291A", use: "Sidebar, khung xem trước"},
  {name: "Mực", value: "#0F2418", use: "Tiêu đề, số liệu"},
  {name: "Nền trang", value: "#F4F6F3", use: "Nền sau các thẻ"},
  {name: "Chi / cảnh báo", value: "#E9725F", use: "Khoản chi, lỗi"},
];

const WEIGHTS = [
  {weight: 400, label: "Thân văn bản"},
  {weight: 600, label: "Phụ, chú thích"},
  {weight: 700, label: "Nhãn, tiêu đề thẻ"},
  {weight: 800, label: "Tiêu đề trang, con số"},
] as const;

export default function TokensPage() {
  const [seg, setSeg] = useState<"a" | "b" | "c">("a");
  return (
    <main className="page">
      <PageHeader title="Hệ thiết kế" subtitle="Màu, chữ và các khối giao diện dùng chung cho mọi trang quản trị — trang mới chỉ dùng những gì có ở đây." />

      <div className="grid grid-halves">
        <Panel title="Màu thương hiệu" subtitle="Lấy từ shared/design/tokens.json, dùng chung với ứng dụng điện thoại.">
          <div className="swatches">
            {BRAND.map(c => (
              <div key={c.value} className="swatch">
                <span className="swatch-chip" style={{background: c.value}} />
                <div>
                  <div className="cell-main">{c.name}</div>
                  <div className="cell-sub">
                    <code>{c.value}</code> · {c.use}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Bảng màu biểu đồ" subtitle="Thứ tự cố định đã chạy bộ kiểm tra mù màu; loại thứ 9 trở đi gộp vào “Khác”, không lặp màu.">
          <div className="swatches">
            {CHART_PALETTE.map((c, i) => (
              <div key={c} className="swatch">
                <span className="swatch-chip" style={{background: c}} />
                <div>
                  <div className="cell-main">Vị trí {i + 1}</div>
                  <div className="cell-sub">
                    <code>{c}</code>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted" style={{marginTop: 14, lineHeight: 1.55}}>
            Thu – chi dùng cặp riêng: thu <code>#2E6F40</code>, chi <code>#E9725F</code>; biểu đồ luôn kèm chú thích và nút “Xem bảng số liệu”.
          </p>
        </Panel>
      </div>

      <div className="grid grid-halves">
        <Panel title="Chữ — Open Sans" subtitle="Nhúng kèm trong web-admin, không tải từ mạng.">
          <div className="grid" style={{gap: 10}}>
            {WEIGHTS.map(w => (
              <div key={w.weight} className="row" style={{gap: 16}}>
                <span className="text-muted tabular" style={{width: 36, fontSize: 12}}>{w.weight}</span>
                <span style={{fontWeight: w.weight, fontSize: 16}}>Bón thúc hoa cúc lần 2 — {w.label}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Nút và nhãn">
          <div className="grid" style={{gap: 16}}>
            <div className="row row-wrap">
              <button className="btn btn-primary" type="button">
                <IconPlus size={18} /> Nút chính
              </button>
              <button className="btn btn-secondary" type="button">
                Nút phụ
              </button>
              <button className="btn btn-ghost" type="button">
                Nút chữ
              </button>
              <button className="btn btn-danger btn-sm" type="button">
                Xoá
              </button>
            </div>
            <div className="row row-wrap" style={{gap: 6}}>
              <Pill tone="green">Hoạt động</Pill>
              <Pill tone="lime">Sinh trưởng</Pill>
              <Pill tone="amber">Chờ duyệt</Pill>
              <Pill tone="red">Lỗi</Pill>
              <Pill tone="blue">Quản trị</Pill>
              <Pill tone="purple">Khác</Pill>
              <Pill tone="gray">Nháp</Pill>
            </div>
            <Segmented<"a" | "b" | "c">
              label="Ví dụ bộ chọn"
              value={seg}
              onChange={setSeg}
              options={[
                {value: "a", label: "Tháng"},
                {value: "b", label: "Quý"},
                {value: "c", label: "Năm"},
              ]}
            />
            <div style={{maxWidth: 320}}>
              <Meter value={3} max={4} label="Ví dụ thanh tiến độ" />
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid grid-kpi">
        <StatCard label="Thẻ số liệu" tone="green" icon={<IconFarms size={22} />} value="1.410 m²" sub="Nhãn · con số · chú thích" />
        <StatCard label="Tông xanh dương" tone="blue" icon={<IconBook size={22} />} value="34" sub="Dùng cho thông tin trung tính" />
        <StatCard label="Tông hổ phách" tone="amber" icon={<IconCheck size={22} />} value="5" sub="Việc đang chờ, cần chú ý" />
        <StatCard label="Tông san hô" tone="coral" icon={<IconAlert size={22} />} value="0" sub="Lỗi, khoản lỗ" />
      </div>

      <div className="grid grid-halves">
        <Panel title="Hộp cảnh báo">
          <div className="grid" style={{gap: 10}}>
            <div className="alert-box info">
              <IconCheck size={18} />
              <div className="alert-body">Thông tin: đã lưu, nông hộ nhận ở lần đồng bộ tới.</div>
            </div>
            <div className="alert-box warning">
              <IconAlert size={18} />
              <div className="alert-body">Cảnh báo: mưa to trên 50 mm trong 24 giờ.</div>
            </div>
            <div className="alert-box danger">
              <IconAlert size={18} />
              <div className="alert-body">Nguy hiểm: mưa rất to trên 100 mm.</div>
            </div>
          </div>
        </Panel>
        <Panel title="Trạng thái trống">
          <EmptyState icon={<IconBook />} title="Chưa có gì ở đây" body="Một câu nói vì sao trống và việc cần làm tiếp." />
        </Panel>
      </div>
    </main>
  );
}
