"use client";

/**
 * Cài đặt — the signed-in account and its password, for farmers and admins
 * alike (POST /auth/change-password, 204 on success). Admins also see which
 * server this site talks to and whether it is healthy (GET /health): the
 * address is the one the phones must be pointed at too.
 */

import {FormEvent, useEffect, useState} from "react";

import {useAdmin} from "@/components/AdminShell";
import {IconCheck, IconExternal, IconLogout} from "@/components/icons";
import {PageHeader, Panel, Pill, Skeleton, Toast} from "@/components/ui";
import {api, API_URL, ApiError, setToken} from "@/lib/api";
import {initialOf} from "@/lib/format";

interface Health {
  status: string;
  app: string;
  version: string;
  database: string;
  static_data: Record<string, boolean>;
}

const STATIC_LABELS: Record<string, string> = {
  crop_varieties: "Danh mục cây trồng",
  care_protocols: "Lịch chăm sóc",
  fertilizer_recommendations: "Định mức phân bón",
};

export default function SettingsPage() {
  const {me, isAdmin} = useAdmin();
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    api<Health>("/health")
      .then(setHealth)
      .catch(e => setHealthError(e instanceof Error ? e.message : String(e)));
  }, [isAdmin]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPw.length < 6) {
      setError("Mật khẩu mới phải có ít nhất 6 ký tự");
      return;
    }
    if (newPw !== confirmPw) {
      setError("Mật khẩu mới và phần nhập lại không khớp");
      return;
    }
    setSubmitting(true);
    try {
      await api("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({current_password: currentPw, new_password: newPw}),
      });
      setToast("Đã đổi mật khẩu");
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không đổi được mật khẩu");
    } finally {
      setSubmitting(false);
    }
  }

  const signOut = () => {
    setToken(null);
    window.location.replace("/login");
  };

  return (
    <main className="page">
      <PageHeader title="Cài đặt" subtitle="Tài khoản đang đăng nhập và mật khẩu của bạn." />

      <div className="grid grid-halves" style={{alignItems: "start"}}>
        <Panel title="Đổi mật khẩu" subtitle="Phiên đăng nhập trên máy khác vẫn dùng được tới khi hết hạn.">
          <form className="form" onSubmit={submit} noValidate>
            <label className="field">
              <span className="field-label">Mật khẩu hiện tại</span>
              <input className="input" type="password" required autoComplete="current-password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} />
            </label>
            <label className="field">
              <span className="field-label">Mật khẩu mới</span>
              <input className="input" type="password" required minLength={6} autoComplete="new-password" value={newPw} onChange={e => setNewPw(e.target.value)} />
              <span className="field-hint">Ít nhất 6 ký tự.</span>
            </label>
            <label className="field">
              <span className="field-label">Nhập lại mật khẩu mới</span>
              <input className="input" type="password" required minLength={6} autoComplete="new-password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} />
            </label>
            {error ? (
              <p className="error" role="alert">
                {error}
              </p>
            ) : null}
            <div className="form-actions">
              <button className="btn btn-primary" type="submit" disabled={submitting || !currentPw || !newPw || !confirmPw}>
                {submitting ? "Đang lưu…" : "Đổi mật khẩu"}
              </button>
            </div>
          </form>
        </Panel>

        <div className="grid" style={{gap: 20}}>
          <Panel title="Tài khoản">
            <div className="row" style={{gap: 14}}>
              <span className="avatar" style={{width: 52, height: 52, fontSize: 20}}>
                {initialOf(me.full_name || me.username)}
              </span>
              <div style={{minWidth: 0}}>
                <div className="cell-main" style={{fontSize: 17}}>{me.full_name}</div>
                <div className="cell-sub">@{me.username}</div>
              </div>
              <span className="spacer" />
              {isAdmin ? <Pill tone="blue">Quản trị viên</Pill> : <Pill tone="green">Nông hộ</Pill>}
            </div>
            <dl className="facts">
              <div>
                <dt>Vùng</dt>
                <dd>{me.region ?? "—"}</dd>
              </div>
              <div>
                <dt>Quyền</dt>
                <dd>{isAdmin ? "Xem và sửa sổ sách mọi nông hộ, danh mục, thông báo" : "Xem sổ sách của trang trại mình"}</dd>
              </div>
            </dl>
            <button className="btn btn-secondary" type="button" onClick={signOut} style={{marginTop: 16}}>
              <IconLogout size={18} /> Đăng xuất
            </button>
          </Panel>

          {isAdmin ? (
            <Panel title="Máy chủ" subtitle="Máy chủ API mà trang web này đang dùng; điện thoại nông hộ đồng bộ với cùng máy chủ qua địa chỉ mạng LAN của nó.">
              <dl className="facts" style={{marginTop: 0}}>
                <div>
                  <dt>Địa chỉ API</dt>
                  <dd>
                    <code>{API_URL}</code>
                  </dd>
                </div>
                <div>
                  <dt>Tình trạng</dt>
                  <dd>
                    {health ? (
                      health.status === "ok" ? (
                        <Pill tone="green">
                          <IconCheck size={14} /> Hoạt động bình thường
                        </Pill>
                      ) : (
                        <Pill tone="amber">Có lỗi: {health.database}</Pill>
                      )
                    ) : healthError ? (
                      <Pill tone="red">Không kết nối được</Pill>
                    ) : (
                      <Skeleton height={20} width={160} />
                    )}
                  </dd>
                </div>
                {health ? (
                  <>
                    <div>
                      <dt>Phiên bản</dt>
                      <dd>
                        {health.app} {health.version}
                      </dd>
                    </div>
                    <div>
                      <dt>Dữ liệu dùng chung</dt>
                      <dd className="row row-wrap" style={{gap: 6}}>
                        {Object.entries(health.static_data).map(([key, ok]) => (
                          <Pill key={key} tone={ok ? "green" : "red"}>
                            {STATIC_LABELS[key] ?? key}
                          </Pill>
                        ))}
                      </dd>
                    </div>
                  </>
                ) : null}
              </dl>
              <a className="btn btn-ghost btn-sm" href={`${API_URL}/docs`} target="_blank" rel="noreferrer" style={{marginTop: 12, paddingInline: 0}}>
                Tài liệu API (Swagger) <IconExternal size={16} />
              </a>
            </Panel>
          ) : null}
        </div>
      </div>
      {toast ? <Toast message={toast} onDone={() => setToast(null)} /> : null}
    </main>
  );
}
