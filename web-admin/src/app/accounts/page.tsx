"use client";

/**
 * Trang quản lý tài khoản nông hộ — chỉ admin mới vào được.
 *
 * Tính năng:
 * - Danh sách tất cả tài khoản (farmer + admin) với trạng thái active/locked.
 * - Form tạo nhanh tài khoản mới (username, password, họ tên, vùng, vai trò).
 * - Nút Khoá / Mở khoá từng tài khoản; admin không thể tự khoá chính mình.
 * - Hiển thị thông báo lỗi rõ ràng (409 khi username trùng, 403 khi tự khoá).
 */

import Link from "next/link";
import {useRouter} from "next/navigation";
import {useCallback, useEffect, useRef, useState} from "react";

import {api, ApiError, getToken, type SessionUser} from "@/lib/api";

interface AccountRow {
  id: string;
  username: string;
  full_name: string;
  region: string | null;
  role: string;
  is_active: boolean;
}

interface CreateForm {
  username: string;
  password: string;
  full_name: string;
  phone: string;
  region: string;
  role: "farmer" | "admin";
}

const EMPTY_FORM: CreateForm = {
  username: "",
  password: "",
  full_name: "",
  phone: "",
  region: "",
  role: "farmer",
};

export default function AccountsPage() {
  const router = useRouter();
  const [me, setMe] = useState<SessionUser | null>(null);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Form tạo tài khoản
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const usernameRef = useRef<HTMLInputElement>(null);

  // Tải danh sách tài khoản — GET /users trả UserSummary kèm is_active
  const loadAccounts = useCallback(async () => {
    const list = await api<AccountRow[]>("/users");
    setAccounts(list);
  }, []);

  // Load session và danh sách
  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    api<SessionUser>("/auth/me")
      .then((user) => {
        if (user.role !== "admin") {
          router.replace("/dashboard");
          return;
        }
        setMe(user);
        return loadAccounts();
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) router.replace("/login");
        else setError(e instanceof Error ? e.message : String(e));
      });
  }, [router, loadAccounts]);

  // Focus vào input username khi mở form
  useEffect(() => {
    if (showForm) setTimeout(() => usernameRef.current?.focus(), 50);
  }, [showForm]);

  async function handleToggleStatus(account: AccountRow) {
    if (busyId) return;
    const nextActive = !account.is_active;
    const action = nextActive ? "mở khoá" : "khoá";
    if (!confirm(`Bạn có chắc muốn ${action} tài khoản "${account.username}"?`)) return;
    setBusyId(account.id);
    setNote(null);
    try {
      const updated = await api<AccountRow>(`/users/${account.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({is_active: nextActive}),
      });
      setAccounts((prev) => prev.map((a) => (a.id === updated.id ? {...a, is_active: updated.is_active} : a)));
      setNote(`Đã ${action} tài khoản "${account.username}"`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Không thực hiện được");
    } finally {
      setBusyId(null);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;
    setFormError(null);
    setCreating(true);
    try {
      const newAccount = await api<AccountRow>("/users", {
        method: "POST",
        body: JSON.stringify({
          username: form.username.trim(),
          password: form.password,
          full_name: form.full_name.trim(),
          phone: form.phone.trim() || null,
          region: form.region.trim() || null,
          role: form.role,
        }),
      });
      setAccounts((prev) => [...prev, newAccount].sort((a, b) => a.full_name.localeCompare(b.full_name, "vi")));
      setForm(EMPTY_FORM);
      setShowForm(false);
      setNote(`Đã tạo tài khoản "${newAccount.username}"`);
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Không tạo được tài khoản");
    } finally {
      setCreating(false);
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
          <h1 className="title">Quản lý tài khoản</h1>
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

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {note && <p className="success">{note}</p>}

      {/* Nút mở form tạo tài khoản */}
      <section className="card" style={{marginBottom: "1.5rem"}}>
        <div className="row-between">
          <h2 className="h2">Danh sách tài khoản ({accounts.length})</h2>
          {!showForm && (
            <button className="btn btn-primary" type="button" onClick={() => setShowForm(true)}>
              + Tạo tài khoản mới
            </button>
          )}
        </div>

        {/* ─── Form tạo nhanh ─── */}
        {showForm && (
          <form onSubmit={handleCreate} className="create-form" noValidate>
            <h3 className="h3" style={{marginBottom: "1rem"}}>
              Tạo tài khoản mới
            </h3>
            {formError && (
              <p className="error" role="alert">
                {formError}
              </p>
            )}
            <div className="form-grid">
              <label className="label">
                Tên đăng nhập *
                <input
                  ref={usernameRef}
                  className="input"
                  type="text"
                  required
                  minLength={3}
                  maxLength={64}
                  value={form.username}
                  onChange={(e) => setForm((f) => ({...f, username: e.target.value}))}
                  placeholder="vd: nguyenvanA"
                  autoComplete="off"
                />
              </label>
              <label className="label">
                Mật khẩu *
                <input
                  className="input"
                  type="password"
                  required
                  minLength={6}
                  maxLength={128}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({...f, password: e.target.value}))}
                  placeholder="Tối thiểu 6 ký tự"
                  autoComplete="new-password"
                />
              </label>
              <label className="label">
                Họ và tên *
                <input
                  className="input"
                  type="text"
                  required
                  maxLength={128}
                  value={form.full_name}
                  onChange={(e) => setForm((f) => ({...f, full_name: e.target.value}))}
                  placeholder="vd: Nguyễn Văn A"
                />
              </label>
              <label className="label">
                Số điện thoại
                <input
                  className="input"
                  type="tel"
                  maxLength={32}
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({...f, phone: e.target.value}))}
                  placeholder="vd: 0901234567"
                />
              </label>
              <label className="label">
                Vùng / địa phương
                <input
                  className="input"
                  type="text"
                  maxLength={128}
                  value={form.region}
                  onChange={(e) => setForm((f) => ({...f, region: e.target.value}))}
                  placeholder="vd: Đồng Nai"
                />
              </label>
              <label className="label">
                Vai trò
                <select className="input" value={form.role} onChange={(e) => setForm((f) => ({...f, role: e.target.value as "farmer" | "admin"}))}>
                  <option value="farmer">Nông hộ</option>
                  <option value="admin">Quản trị viên</option>
                </select>
              </label>
            </div>
            <div className="form-actions">
              <button className="btn btn-primary" type="submit" disabled={creating}>
                {creating ? "Đang tạo…" : "Tạo tài khoản"}
              </button>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setForm(EMPTY_FORM);
                  setFormError(null);
                }}
              >
                Huỷ
              </button>
            </div>
          </form>
        )}
      </section>

      {/* ─── Bảng danh sách ─── */}
      <section className="card">
        {accounts.length === 0 ? (
          <p className="muted">Chưa có tài khoản nào.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Họ tên</th>
                  <th scope="col">Tên đăng nhập</th>
                  <th scope="col">Vùng</th>
                  <th scope="col">Vai trò</th>
                  <th scope="col">Trạng thái</th>
                  <th scope="col">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id} style={{opacity: busyId === a.id ? 0.5 : 1}}>
                    <td>{a.full_name}</td>
                    <td>
                      <code>{a.username}</code>
                    </td>
                    <td>{a.region ?? <span className="muted">—</span>}</td>
                    <td>
                      <span className={a.role === "admin" ? "badge badge-blue" : "badge badge-green"}>{a.role === "admin" ? "Quản trị" : "Nông hộ"}</span>
                    </td>
                    <td>
                      <span className={a.is_active !== false ? "badge badge-green" : "badge badge-gray"}>{a.is_active !== false ? "Hoạt động" : "Đã khoá"}</span>
                    </td>
                    <td>
                      {a.id !== me.id ? (
                        <button
                          className={a.is_active !== false ? "btn btn-danger-sm" : "btn btn-secondary-sm"}
                          type="button"
                          disabled={busyId !== null}
                          onClick={() => handleToggleStatus(a)}
                          aria-label={`${a.is_active !== false ? "Khoá" : "Mở khoá"} ${a.username}`}
                        >
                          {busyId === a.id ? "…" : a.is_active !== false ? "Khoá" : "Mở khoá"}
                        </button>
                      ) : (
                        <span className="muted small">Tài khoản bạn</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
