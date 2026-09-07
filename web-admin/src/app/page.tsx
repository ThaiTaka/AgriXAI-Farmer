/**
 * Giai đoạn 0 — trang kiểm tra nền tảng.
 *
 * Trang này chỉ để xác nhận design token và font Open Sans đã nạp đúng.
 * Nó sẽ được thay bằng trang Đăng nhập / Dashboard thật ở Giai đoạn 4.
 */

const SEVERITIES = [
  { key: "none", label: "Khoẻ mạnh" },
  { key: "mild", label: "Nhẹ" },
  { key: "moderate", label: "Trung bình" },
  { key: "severe", label: "Nặng" },
] as const;

const WEIGHTS = [
  { weight: 400, label: "Thân văn bản" },
  { weight: 500, label: "Nhấn nhẹ" },
  { weight: 600, label: "Phụ / meta" },
  { weight: 700, label: "Tiêu đề thẻ" },
  { weight: 800, label: "Tiêu đề màn hình" },
] as const;

export default function Page() {
  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "34px 26px 60px",
        background: "var(--color-green-050)",
      }}
    >
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 11 }}>
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: "var(--radius-lg)",
              background: "var(--gradient-primaryaction)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flex: "none",
              boxShadow: "var(--shadow-logo)",
            }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden>
              <path d="M12 22C12 13 16 4 22 2c0 10-4 18-10 20Z" fill="var(--color-lime-500)" />
              <path d="M12 22C12 14 8 6 2 5c0 9 4 16 10 17Z" fill="var(--color-green-075)" />
            </svg>
          </div>
          <div>
            <h1
              style={{
                fontSize: "var(--text-screen-title-size)",
                fontWeight: 800,
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
              }}
            >
              AgriLog v2 — Quản trị
            </h1>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--color-green-400)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                marginTop: 3,
              }}
            >
              Giai đoạn 0 · nền tảng đã dựng xong
            </div>
          </div>
        </div>

        <p
          style={{
            maxWidth: 760,
            fontSize: 15,
            lineHeight: 1.6,
            color: "var(--color-text-secondary)",
          }}
        >
          Trang này xác nhận design token (sinh từ{" "}
          <code>shared/design/tokens.json</code>) và font Open Sans nhúng kèm đã nạp đúng. Các trang
          quản trị thật — Dashboard, Quản lý tài khoản, Quản lý giá phân bón, Báo cáo Kho &amp;
          Thu-chi — sẽ được xây ở Giai đoạn 4.
        </p>

        <section style={{ marginTop: 30 }}>
          <h2 style={{ fontSize: 21, fontWeight: 800, marginBottom: 12 }}>Mức độ bệnh</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {SEVERITIES.map((s) => (
              <span
                key={s.key}
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  padding: "8px 15px",
                  borderRadius: "var(--radius-pill)",
                  background: `var(--severity-${s.key}-bg)`,
                  color: `var(--severity-${s.key}-fg)`,
                }}
              >
                {s.label}
              </span>
            ))}
          </div>
          <p style={{ marginTop: 10, fontSize: 12.5, color: "var(--color-text-alpha-68)" }}>
            Mức <strong>Nặng</strong> cố ý dùng nền đặc để đọc được khi liếc nhanh ngoài nắng.
          </p>
        </section>

        <section style={{ marginTop: 30 }}>
          <h2 style={{ fontSize: 21, fontWeight: 800, marginBottom: 12 }}>Chữ — Open Sans</h2>
          <div
            style={{
              padding: 20,
              borderRadius: "var(--radius-6xl)",
              background: "#fff",
              border: "1px solid var(--color-border-soft)",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {WEIGHTS.map((w) => (
              <div key={w.weight} style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                <span
                  style={{
                    flex: "none",
                    width: 44,
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--color-text-eyebrow)",
                  }}
                >
                  {w.weight}
                </span>
                <span style={{ fontWeight: w.weight, fontSize: 17 }}>
                  Cà chua bị mốc sương muộn — {w.label}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section style={{ marginTop: 30 }}>
          <h2 style={{ fontSize: 21, fontWeight: 800, marginBottom: 12 }}>Backend</h2>
          <div
            style={{
              padding: 20,
              borderRadius: "var(--radius-6xl)",
              background: "var(--color-green-100)",
              fontSize: 13.5,
              lineHeight: 1.6,
              color: "var(--color-green-800)",
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
