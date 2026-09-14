/**
 * Trang kiểm tra nền tảng của web-admin.
 *
 * Xác nhận design token (sinh từ shared/design/tokens.json) và font Open Sans
 * nhúng kèm đã nạp đúng. Từ Giai đoạn 4, trang gốc chuyển sang Đăng nhập / Dashboard; trang này nằm ở /tokens.
 */

const WEIGHTS = [
  { weight: 400, label: "Thân văn bản" },
  { weight: 500, label: "Nhấn nhẹ" },
  { weight: 600, label: "Phụ / meta" },
  { weight: 700, label: "Tiêu đề thẻ" },
  { weight: 800, label: "Tiêu đề màn hình" },
] as const;

const BADGES = [
  { label: "Phổ biến", bg: "var(--color-badge-greenbg)", fg: "var(--color-badge-greenfg)" },
  { label: "Mới", bg: "var(--color-badge-bluebg)", fg: "var(--color-badge-bluefg)" },
  { label: "Premium", bg: "var(--color-badge-purplebg)", fg: "var(--color-badge-purplefg)" },
  { label: "Chưa có dữ liệu giá", bg: "var(--color-badge-yellowbg)", fg: "var(--color-badge-yellowfg)" },
  { label: "Tồn thấp", bg: "var(--color-badge-redbg)", fg: "var(--color-badge-redfg)" },
] as const;

const card = {
  padding: "var(--space-xl)",
  borderRadius: "var(--radius-md)",
  background: "var(--color-surface-card)",
  border: "1px solid var(--color-border-default)",
  boxShadow: "var(--shadow-sm)",
} as const;

export default function Page() {
  return (
    <main style={{ minHeight: "100vh", padding: "var(--space-3xl) var(--space-xl) 60px" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "var(--radius-sm)",
              background: "var(--color-primary-default)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flex: "none",
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
              <path d="M12 22C12 13 16 4 22 2c0 10-4 18-10 20Z" fill="var(--color-green-500)" />
              <path d="M12 22C12 14 8 6 2 5c0 9 4 16 10 17Z" fill="var(--color-white)" />
            </svg>
          </div>
          <div>
            <h1
              style={{
                fontSize: "var(--text-title-size)",
                fontWeight: 800,
                letterSpacing: "-0.02em",
                lineHeight: 1.15,
              }}
            >
              AgriLog v2 — Quản trị
            </h1>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "var(--color-text-muted)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginTop: 2,
              }}
            >
              Nền tảng · hệ thiết kế v5
            </div>
          </div>
        </div>

        <p
          style={{
            maxWidth: 720,
            fontSize: 15,
            lineHeight: 1.6,
            color: "var(--color-text-muted)",
          }}
        >
          Trang này xác nhận design token (sinh từ <code>shared/design/tokens.json</code>) và font
          Open Sans nhúng kèm đã nạp đúng. Các trang quản trị thật — Dashboard, tài khoản, duyệt giống
          cây, giá phân bón, báo cáo Kho &amp; Thu-chi — sẽ được xây ở Giai đoạn 4.
        </p>

        <section style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Chữ — Open Sans</h2>
          <div style={{ ...card, display: "flex", flexDirection: "column", gap: 8 }}>
            {WEIGHTS.map((w) => (
              <div key={w.weight} style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                <span
                  style={{
                    flex: "none",
                    width: 44,
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--color-text-muted)",
                  }}
                >
                  {w.weight}
                </span>
                <span style={{ fontWeight: w.weight, fontSize: 17 }}>
                  Bón thúc đợt 2 cho cà chua — {w.label}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Nhãn trạng thái</h2>
          <div style={{ ...card, display: "flex", flexWrap: "wrap", gap: 8 }}>
            {BADGES.map((b) => (
              <span
                key={b.label}
                style={{
                  padding: "3px 8px",
                  borderRadius: "var(--radius-pill)",
                  background: b.bg,
                  color: b.fg,
                  fontSize: 11.5,
                  fontWeight: 700,
                }}
              >
                {b.label}
              </span>
            ))}
          </div>
        </section>

        <section style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Backend</h2>
          <div
            style={{
              ...card,
              background: "var(--color-primary-soft)",
              fontSize: 14,
              lineHeight: 1.6,
              color: "var(--color-text-secondary)",
            }}
          >
            API chạy ở <code>http://127.0.0.1:8000</code> — kiểm tra{" "}
            <a href="http://127.0.0.1:8000/health">/health</a> và tài liệu{" "}
            <a href="http://127.0.0.1:8000/docs">/docs</a>.
          </div>
        </section>
      </div>
    </main>
  );
}
