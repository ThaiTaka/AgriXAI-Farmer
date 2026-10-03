"use client";

/**
 * Tài khoản — every login of the system, farmers and admins.
 *
 * Admin creates an account for a household (they then sign in on the phone),
 * locks one that should no longer sync and unlocks it again. An admin cannot
 * lock their own account (the server answers 403). Each farm row also shows
 * how many plots it has and when the phone last sent anything, from
 * /dashboard/overview.
 */

import Link from "next/link";
import {FormEvent, useEffect, useMemo, useState} from "react";

import {useAdmin} from "@/components/AdminShell";
import {IconFarms, IconPlus, IconSearch, IconUsers} from "@/components/icons";
import {EmptyState, Modal, PageHeader, Panel, Pill, Segmented, Skeleton, StatCard, Toast} from "@/components/ui";
import {api, ApiError} from "@/lib/api";
import {initialOf, timeAgo} from "@/lib/format";
import type {Overview} from "@/lib/types";

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

type RoleFilter = "all" | "farmer" | "admin" | "locked";

const EMPTY_FORM: CreateForm = {
  username: "",
  password: "",
  full_name: "",
  phone: "",
  region: "Làng hoa Vạn Thành, Đà Lạt",
  role: "farmer",
};

export default function AccountsPage() {
  const {me, reloadFarms} = useAdmin();
  const [accounts, setAccounts] = useState<AccountRow[] | null>(null);
  const [activity, setActivity] = useState<Map<string, Overview["farms"][number]>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{message: string; tone?: "green" | "red"} | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<RoleFilter>("all");

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    Promise.all([api<AccountRow[]>("/users"), api<Overview>("/dashboard/overview").catch(() => null)])
      .then(([list, overview]) => {
        setAccounts(list.sort((a, b) => a.full_name.localeCompare(b.full_name, "vi")));
        if (overview) setActivity(new Map(overview.farms.map(f => [f.id, f])));
      })
      .catch(e => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const counts = useMemo(() => {
    const rows = accounts ?? [];
    return {
      all: rows.length,
      farmer: rows.filter(a => a.role === "farmer").length,
      admin: rows.filter(a => a.role === "admin").length,
      locked: rows.filter(a => a.is_active === false).length,
    };
  }, [accounts]);

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("vi");
    return (accounts ?? []).filter(a => {
      if (filter === "locked" ? a.is_active !== false : filter !== "all" && a.role !== filter) return false;
      if (!q) return true;
      return [a.full_name, a.username, a.region ?? ""].some(s => s.toLocaleLowerCase("vi").includes(q));
    });
  }, [accounts, filter, query]);

  async function toggleStatus(account: AccountRow) {
    if (busyId) return;
    const nextActive = account.is_active === false;
    const action = nextActive ? "mở khoá" : "khoá";
    const warning = nextActive ? "" : "\nĐiện thoại của tài khoản này sẽ không đồng bộ được nữa cho tới khi mở khoá.";
    if (!window.confirm(`${nextActive ? "Mở khoá" : "Khoá"} tài khoản "${account.username}"?${warning}`)) return;
    setBusyId(account.id);
    try {
      const updated = await api<AccountRow>(`/users/${account.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({is_active: nextActive}),
      });
      setAccounts(prev => (prev ?? []).map(a => (a.id === updated.id ? {...a, is_active: updated.is_active} : a)));
      setToast({message: `Đã ${action} tài khoản "${account.username}"`});
    } catch (e) {
      setToast({message: e instanceof ApiError ? e.message : "Không thực hiện được", tone: "red"});
    } finally {
      setBusyId(null);
    }
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    if (creating) return;
    setFormError(null);
    setCreating(true);
    try {
      const created = await api<AccountRow>("/users", {
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
      setAccounts(prev => [...(prev ?? []), created].sort((a, b) => a.full_name.localeCompare(b.full_name, "vi")));
      if (created.role === "farmer") await reloadFarms();
      setForm(EMPTY_FORM);
      setShowForm(false);
      setToast({message: `Đã tạo tài khoản "${created.username}"`});
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Không tạo được tài khoản");
    } finally {
      setCreating(false);
    }
  }

  const set = (patch: Partial<CreateForm>) => setForm(f => ({...f, ...patch}));
  const placeholder = <Skeleton height={28} width={40} />;

  return (
    <main className="page">
      <PageHeader
        title="Tài khoản"
        subtitle="Mỗi nông hộ một tài khoản để đăng nhập trên điện thoại. Khoá tài khoản thì máy đó ngừng đồng bộ."
        actions={
          <button className="btn btn-primary" type="button" onClick={() => setShowForm(true)}>
            <IconPlus size={18} /> Tạo tài khoản
          </button>
        }
      />
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid grid-kpi">
        <StatCard label="Tổng tài khoản" tone="gray" icon={<IconUsers size={22} />} value={accounts ? counts.all : placeholder} sub="Nông hộ và quản trị viên" />
        <StatCard label="Nông hộ" tone="green" icon={<IconFarms size={22} />} value={accounts ? counts.farmer : placeholder} sub={`${[...activity.values()].filter(f => f.last_activity != null).length} hộ đã đồng bộ dữ liệu`} />
        <StatCard label="Quản trị viên" tone="blue" icon={<IconUsers size={22} />} value={accounts ? counts.admin : placeholder} sub="Dùng trang web này" />
        <StatCard label="Đang bị khoá" tone={counts.locked > 0 ? "coral" : "gray"} icon={<IconUsers size={22} />} value={accounts ? counts.locked : placeholder} sub="Không đăng nhập, không đồng bộ" />
      </div>

      <Panel
        title="Danh sách tài khoản"
        action={
          <div className="toolbar">
            <label className="search">
              <IconSearch size={18} />
              <input className="input" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm tên, tên đăng nhập, vùng" aria-label="Tìm tài khoản" />
            </label>
            <Segmented<RoleFilter>
              label="Lọc tài khoản"
              value={filter}
              onChange={setFilter}
              options={[
                {value: "all", label: `Tất cả ${counts.all}`},
                {value: "farmer", label: `Nông hộ ${counts.farmer}`},
                {value: "admin", label: `Quản trị ${counts.admin}`},
                {value: "locked", label: `Đã khoá ${counts.locked}`},
              ]}
            />
          </div>
        }
        flush>
        {accounts == null ? (
          <div className="panel-body">
            <Skeleton height={180} />
          </div>
        ) : visible.length === 0 ? (
          <EmptyState icon={<IconUsers />} title="Không có tài khoản nào khớp" body="Thử bỏ bớt từ tìm kiếm hoặc chọn bộ lọc khác." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Người dùng</th>
                  <th>Vai trò</th>
                  <th className="num">Lô đất</th>
                  <th>Đồng bộ gần nhất</th>
                  <th>Trạng thái</th>
                  <th aria-label="Thao tác" />
                </tr>
              </thead>
              <tbody>
                {visible.map(a => {
                  const active = a.is_active !== false;
                  const farm = activity.get(a.id);
                  return (
                    <tr key={a.id} style={{opacity: busyId === a.id ? 0.55 : 1}}>
                      <td>
                        <div className="row" style={{gap: 12}}>
                          <span className="avatar" style={active ? undefined : {filter: "grayscale(1)", opacity: 0.6}}>
                            {initialOf(a.full_name || a.username)}
                          </span>
                          <div style={{minWidth: 0}}>
                            <div className="cell-main">{a.full_name}</div>
                            <div className="cell-sub">
                              @{a.username}
                              {a.region ? ` · ${a.region}` : ""}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>{a.role === "admin" ? <Pill tone="blue">Quản trị</Pill> : <Pill tone="green">Nông hộ</Pill>}</td>
                      <td className="num">{a.role === "farmer" ? (farm?.plots ?? 0) : <span className="text-muted">—</span>}</td>
                      <td className={farm?.last_activity ? undefined : "text-muted"}>{a.role === "farmer" ? (farm?.last_activity ? timeAgo(farm.last_activity) : "Chưa đồng bộ") : "—"}</td>
                      <td>
                        {active ? (
                          <Pill tone="green">
                            <i className="dot" style={{background: "#2e6f40"}} /> Hoạt động
                          </Pill>
                        ) : (
                          <Pill tone="gray">Đã khoá</Pill>
                        )}
                      </td>
                      <td>
                        <div className="row-actions" style={{justifyContent: "flex-end"}}>
                          {a.role === "farmer" ? (
                            <Link className="btn btn-ghost btn-sm" href={`/farms?owner=${a.id}`}>
                              Sổ sách
                            </Link>
                          ) : null}
                          {a.id !== me.id ? (
                            <button
                              className={active ? "btn btn-secondary btn-sm" : "btn btn-primary btn-sm"}
                              type="button"
                              disabled={busyId !== null}
                              onClick={() => toggleStatus(a)}
                              aria-label={`${active ? "Khoá" : "Mở khoá"} ${a.username}`}>
                              {active ? "Khoá" : "Mở khoá"}
                            </button>
                          ) : (
                            <Pill tone="lime">Bạn</Pill>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {showForm ? (
        <Modal
          title="Tạo tài khoản mới"
          onClose={() => {
            setShowForm(false);
            setFormError(null);
          }}
          wide>
          <form className="form" onSubmit={create}>
            <div className="form-grid">
              <label className="field">
                <span className="field-label">Họ và tên</span>
                <input className="input" required maxLength={128} value={form.full_name} onChange={e => set({full_name: e.target.value})} placeholder="VD: Nguyễn Văn An" autoFocus />
              </label>
              <label className="field">
                <span className="field-label">Vai trò</span>
                <select className="input" value={form.role} onChange={e => set({role: e.target.value as CreateForm["role"]})}>
                  <option value="farmer">Nông hộ — dùng ứng dụng điện thoại</option>
                  <option value="admin">Quản trị viên — dùng trang web này</option>
                </select>
              </label>
              <label className="field">
                <span className="field-label">Tên đăng nhập</span>
                <input className="input" required minLength={3} maxLength={64} value={form.username} onChange={e => set({username: e.target.value})} placeholder="VD: nongho_an" autoComplete="off" />
                <span className="field-hint">3–64 ký tự, nông hộ gõ tên này trên điện thoại.</span>
              </label>
              <label className="field">
                <span className="field-label">Mật khẩu</span>
                <input className="input" type="password" required minLength={6} maxLength={128} value={form.password} onChange={e => set({password: e.target.value})} placeholder="Tối thiểu 6 ký tự" autoComplete="new-password" />
                <span className="field-hint">Người dùng tự đổi lại ở mục Cài đặt.</span>
              </label>
              <label className="field">
                <span className="field-label">Số điện thoại (không bắt buộc)</span>
                <input className="input" type="tel" maxLength={32} value={form.phone} onChange={e => set({phone: e.target.value})} placeholder="VD: 0901 234 567" />
              </label>
              <label className="field">
                <span className="field-label">Vùng / địa phương</span>
                <input className="input" maxLength={128} value={form.region} onChange={e => set({region: e.target.value})} />
              </label>
            </div>
            {formError ? (
              <p className="error" role="alert">
                {formError}
              </p>
            ) : null}
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
                }}>
                Huỷ
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
      {toast ? <Toast message={toast.message} tone={toast.tone} onDone={() => setToast(null)} /> : null}
    </main>
  );
}
