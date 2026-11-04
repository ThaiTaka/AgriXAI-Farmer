"use client";

/**
 * Đăng nhập — cùng tài khoản với ứng dụng điện thoại (tên đăng nhập hoặc email).
 * Nông hộ vào sổ sách của mình; quản trị viên vào trang tổng quan hệ thống.
 */

import {useRouter} from "next/navigation";
import {FormEvent, useState} from "react";

import {ApiError, login} from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await login(username.trim(), password);
      router.replace("/dashboard");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Không kết nối được máy chủ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-shell">
      <aside className="auth-aside" aria-hidden>
        <div className="brand">
          <span className="brand-mark">
            <svg width="22" height="22" viewBox="0 0 24 24">
              <path d="M12 22C12 13 16 4 22 2c0 10-4 18-10 20Z" fill="var(--color-green-300)" />
              <path d="M12 22C12 14 8 6 2 5c0 9 4 16 10 17Z" fill="var(--color-white)" />
            </svg>
          </span>
          <span className="brand-name">AgriLog</span>
        </div>
        <div className="auth-pitch">
          <h2>Nhật ký canh tác, vật tư và chi phí cho nông hộ.</h2>
          <ul>
            <li>Quản lý lô đất, giao lô và theo dõi mùa vụ của từng nông hộ.</li>
            <li>Duyệt giống cây, soạn hướng dẫn chăm sóc, cập nhật giá phân bón dùng chung.</li>
            <li>Đồng bộ với ứng dụng điện thoại — ghi chép được cả khi mất mạng.</li>
          </ul>
        </div>
        <p className="auth-foot">Đồ án tốt nghiệp · Khoa Công nghệ Thông tin · Trường Đại học Đà Lạt</p>
      </aside>

      <section className="auth-main">
        <div className="auth-card">
          <h1 className="auth-title">Đăng nhập</h1>
          <p className="auth-lead">Dùng tài khoản của ứng dụng điện thoại. Quản trị viên xem được mọi nông hộ.</p>

          <form className="auth-form" onSubmit={submit} aria-describedby={error ? "login-error" : undefined}>
            <div className="field">
              <label className="field-label" htmlFor="username">
                Tài khoản
              </label>
              <input
                id="username"
                autoComplete="username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Tên đăng nhập hoặc email"
                required
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="password">
                Mật khẩu
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Mật khẩu"
                required
              />
            </div>
            {error ? (
              <p id="login-error" className="notice tone-red" role="alert">
                {error}
              </p>
            ) : null}
            <button className="btn btn-primary auth-submit" type="submit" disabled={busy}>
              {busy ? "Đang đăng nhập…" : "Đăng nhập"}
            </button>
          </form>

          <div className="auth-demo">
            <p>Tài khoản dùng thử (môi trường demo)</p>
            <dl>
              <dt>Quản trị viên</dt>
              <dd>admin / admin123</dd>
              <dt>Nông hộ</dt>
              <dd>lethanhthai / matkhau123</dd>
            </dl>
          </div>
        </div>
      </section>
    </main>
  );
}
