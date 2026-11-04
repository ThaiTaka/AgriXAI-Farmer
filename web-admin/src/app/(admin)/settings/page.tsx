"use client";

/**
 * Cài đặt tài khoản — thông tin đăng nhập hiện tại và đổi mật khẩu.
 *
 * Mọi người dùng (nông hộ lẫn quản trị viên) đều dùng được.
 * Endpoint: POST /auth/change-password (204 No Content khi thành công).
 */

import {FormEvent, useState} from "react";

import {useAdmin} from "@/components/admin/Shell";
import {Field, Notice, PageHeader, Panel, Pill} from "@/components/admin/ui";
import {api, API_URL, ApiError} from "@/lib/api";

export default function SettingsPage() {
  const {me, isAdmin} = useAdmin();
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không đổi được mật khẩu");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader title="Cài đặt tài khoản" subtitle="Thông tin đăng nhập và bảo mật" />

      <section className="grid grid-2-col" style={{alignItems: "start"}}>
        <Panel title="Thông tin đăng nhập">
          <dl className="detail-list">
            <dt>Họ và tên</dt>
            <dd>{me.full_name}</dd>
            <dt>Tên đăng nhập</dt>
            <dd className="mono">{me.username}</dd>
            <dt>Vai trò</dt>
            <dd>
              <Pill tone={isAdmin ? "blue" : "green"}>{isAdmin ? "Quản trị viên" : "Nông hộ"}</Pill>
            </dd>
            <dt>Địa chỉ</dt>
            <dd>{me.region ?? "—"}</dd>
            <dt>Máy chủ API</dt>
            <dd className="mono">{API_URL}</dd>
          </dl>
        </Panel>

        <Panel title="Đổi mật khẩu" subtitle="Các phiên đăng nhập đã có trên thiết bị khác vẫn hợp lệ cho tới khi mã đăng nhập hết hạn (7 ngày).">
          <form onSubmit={handleSubmit} noValidate>
            <Field label="Mật khẩu hiện tại" htmlFor="pw-current">
              <input id="pw-current" type="password" required autoComplete="current-password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} />
            </Field>
            <Field label="Mật khẩu mới" htmlFor="pw-new" hint="Tối thiểu 6 ký tự.">
              <input id="pw-new" type="password" required minLength={6} autoComplete="new-password" value={newPw} onChange={e => setNewPw(e.target.value)} />
            </Field>
            <Field label="Xác nhận mật khẩu mới" htmlFor="pw-confirm">
              <input id="pw-confirm" type="password" required minLength={6} autoComplete="new-password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} />
            </Field>
            {error ? (
              <div style={{marginTop: 16}}>
                <Notice>{error}</Notice>
              </div>
            ) : null}
            {success ? (
              <div style={{marginTop: 16}}>
                <Notice tone="green">Đã đổi mật khẩu thành công.</Notice>
              </div>
            ) : null}
            <div style={{marginTop: 20}}>
              <button className="btn btn-primary" type="submit" disabled={submitting || !currentPw || !newPw || !confirmPw}>
                {submitting ? "Đang lưu…" : "Đổi mật khẩu"}
              </button>
            </div>
          </form>
        </Panel>
      </section>
    </>
  );
}
