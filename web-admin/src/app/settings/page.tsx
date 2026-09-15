"use client";

/**
 * Trang Cài đặt tài khoản — đổi mật khẩu.
 *
 * Truy cập từ nút "Cài đặt" ở topbar dashboard.
 * Mọi người dùng (farmer lẫn admin) đều dùng được.
 * Endpoint: POST /auth/change-password (204 No Content khi thành công).
 */

import Link from "next/link";
import {useRouter} from "next/navigation";
import {FormEvent, useEffect, useState} from "react";

import {api, ApiError, getToken, type SessionUser} from "@/lib/api";

export default function SettingsPage() {
  const router = useRouter();
  const [me, setMe] = useState<SessionUser | null>(null);

  // Form đổi mật khẩu
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    api<SessionUser>("/auth/me")
      .then(setMe)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) router.replace("/login");
      });
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPw !== confirmPw) {
      setError("Mật khẩu mới và xác nhận không khớp");
      return;
    }
    if (newPw.length < 6) {
      setError("Mật khẩu mới phải có ít nhất 6 ký tự");
      return;
    }

    setSubmitting(true);
    try {
      await api("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({current_password: currentPw, new_password: newPw}),
      });
      setSuccess(true);
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Không đổi được mật khẩu");
    } finally {
      setSubmitting(false);
    }
  }

  const signOut = () => {
    if (typeof window !== "undefined") window.localStorage.removeItem("agrilog.token");
    router.replace("/login");
  };

  if (!me) {
    return (
      <main className="page">
        <p className="muted">Đang tải…</p>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="topbar">
        <div>
          <p className="eyebrow">AgriLog v2 · Quản trị</p>
          <h1 className="title">Cài đặt tài khoản</h1>
          <p className="muted">{me.full_name} ({me.username})</p>
        </div>
        <div className="topbar-actions">
          <Link href="/dashboard" className="btn btn-secondary">
            ← Dashboard
          </Link>
          <button className="btn btn-secondary" type="button" onClick={signOut}>
            Đăng xuất
          </button>
        </div>
      </header>

      {/* ─── Đổi mật khẩu ─── */}
      <section className="card" style={{maxWidth: "480px"}}>
        <h2 className="h2">Đổi mật khẩu</h2>
        <p className="muted small" style={{marginTop: "4px", marginBottom: "1.5rem"}}>
          Sau khi đổi thành công, các phiên đăng nhập cũ trên thiết bị khác vẫn hợp lệ cho tới khi token hết hạn.
        </p>

        {error && (
          <p className="error" role="alert" style={{marginBottom: "1rem"}}>
            {error}
          </p>
        )}
        {success && (
          <p className="success" style={{marginBottom: "1rem"}}>
            ✓ Đổi mật khẩu thành công!
          </p>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form" style={{gap: "1rem"}}>
            <label className="label">
              Mật khẩu hiện tại *
              <input
                className="input"
                type="password"
                required
                autoComplete="current-password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                placeholder="Nhập mật khẩu hiện tại"
              />
            </label>
            <label className="label">
              Mật khẩu mới * (tối thiểu 6 ký tự)
              <input
                className="input"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="Ít nhất 6 ký tự"
              />
            </label>
            <label className="label">
              Xác nhận mật khẩu mới *
              <input
                className="input"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="Nhập lại mật khẩu mới"
              />
            </label>
            <div style={{paddingTop: "0.5rem"}}>
              <button className="btn btn-primary" type="submit" disabled={submitting || !currentPw || !newPw || !confirmPw}>
                {submitting ? "Đang lưu…" : "Đổi mật khẩu"}
              </button>
            </div>
          </div>
        </form>
      </section>
    </main>
  );
}
