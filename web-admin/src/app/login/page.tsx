"use client";

/**
 * Đăng nhập — the same accounts as the phone app (username or email).
 * An admin lands on the overview; a farmer on their own books.
 */

import {useRouter} from "next/navigation";
import {FormEvent, useEffect, useState} from "react";

import {IconBell, IconCheck, IconLeaf, IconWeather} from "@/components/icons";
import {ApiError, getToken, login} from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Already signed in: straight to the app.
  useEffect(() => {
    if (getToken()) router.replace("/dashboard");
  }, [router]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const user = await login(username.trim(), password);
      router.replace(user.role === "admin" ? "/dashboard" : "/farms");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Không kết nối được máy chủ");
      setBusy(false);
    }
  };

  return (
    <main className="auth">
      <section className="auth-brand" aria-label="Giới thiệu">
        <div className="auth-brand-top">
          <span className="sidebar-logo">
            <IconLeaf size={22} />
          </span>
          <div>
            <div className="sidebar-name">AgriLog</div>
            <div className="sidebar-sub">Làng hoa Vạn Thành · Đà Lạt</div>
          </div>
        </div>

        <div>
          <h1 className="auth-headline">Sổ tay nông hộ, gom về một chỗ.</h1>
          <p className="auth-lead">Điện thoại của nông hộ ghi thu – chi, kho phân bón và lịch chăm sóc kể cả khi mất sóng; có mạng là đồng bộ lên đây.</p>
          <ul className="auth-points">
            <li>
              <IconCheck size={18} /> Sổ sách, lô đất và kế hoạch vụ mùa của từng hộ
            </li>
            <li>
              <IconBell size={18} /> Gửi thông báo, giá phân bón mới tới mọi điện thoại
            </li>
            <li>
              <IconWeather size={18} /> Dự báo và cảnh báo mưa to, rét hại cho làng hoa
            </li>
          </ul>
        </div>

        <p className="auth-foot">Thời tiết: Open-Meteo (CC BY 4.0). Ngưỡng cảnh báo theo QĐ 18/2021/QĐ-TTg.</p>
        <svg className="auth-leaves" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="currentColor" d="M12 22C12 13 16 4 22 2c0 10-4 18-10 20Z" />
          <path fill="currentColor" d="M12 22C12 14 8 6 2 5c0 9 4 16 10 17Z" />
        </svg>
      </section>

      <section className="auth-form-wrap">
        <form className="auth-form" onSubmit={submit} aria-describedby={error ? "login-error" : undefined}>
          <div>
            <h1>Đăng nhập</h1>
            <p className="text-muted" style={{marginTop: 6, lineHeight: 1.55}}>
              Dùng tài khoản của ứng dụng điện thoại. Quản trị viên xem được mọi nông hộ.
            </p>
          </div>
          <label className="field">
            <span className="field-label">Tài khoản</span>
            <input className="input" autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} placeholder="Tên đăng nhập hoặc email" autoFocus required />
          </label>
          <label className="field">
            <span className="field-label">Mật khẩu</span>
            <input className="input" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mật khẩu" required />
          </label>
          {error ? (
            <p id="login-error" className="error" role="alert">
              {error}
            </p>
          ) : null}
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? "Đang đăng nhập…" : "Đăng nhập"}
          </button>
          <p className="text-sm text-muted" style={{textAlign: "center"}}>
            Tài khoản dùng thử: <strong>admin</strong> / admin123 · <strong>lethanhthai</strong> / matkhau123
          </p>
        </form>
      </section>
    </main>
  );
}
