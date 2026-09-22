"use client";

/**
 * Đăng nhập — cùng tài khoản với ứng dụng điện thoại (tên đăng nhập hoặc email).
 * Nông hộ vào dashboard của mình; quản trị viên chọn nông hộ để xem.
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
    <main className="page">
      <div className="login">
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            <svg width="22" height="22" viewBox="0 0 24 24">
              <path d="M12 22C12 13 16 4 22 2c0 10-4 18-10 20Z" fill="var(--color-green-500)" />
              <path d="M12 22C12 14 8 6 2 5c0 9 4 16 10 17Z" fill="var(--color-white)" />
            </svg>
          </span>
          <span className="brand-name">AgriLog v2</span>
        </div>
        <h1 className="title">Trang quản trị nông hộ</h1>
        <p className="muted">Dùng tài khoản của ứng dụng điện thoại. Quản trị viên xem được mọi nông hộ.</p>

        <form className="form" onSubmit={submit} aria-describedby={error ? "login-error" : undefined}>
          <label className="label" htmlFor="username">
            Tài khoản
          </label>
          <input
            id="username"
            className="input"
            autoComplete="username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="Tên đăng nhập hoặc email"
            required
          />
          <label className="label" htmlFor="password">
            Mật khẩu
          </label>
          <input
            id="password"
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Mật khẩu"
            required
          />
          {error ? (
            <p id="login-error" className="error" role="alert">
              {error}
            </p>
          ) : null}
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? "Đang đăng nhập…" : "Đăng nhập"}
          </button>
        </form>
        <p className="muted small">Demo: lethanhthai / matkhau123 · admin / admin123</p>
      </div>
    </main>
  );
}
