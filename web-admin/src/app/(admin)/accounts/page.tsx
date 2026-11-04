"use client";

/**
 * Tài khoản — danh sách mọi tài khoản (nông hộ và quản trị viên), tạo tài khoản
 * mới, khoá / mở khoá. Chỉ quản trị viên.
 *
 * - Tạo tài khoản: POST /users (mật khẩu được băm bcrypt ở backend, 409 khi trùng tên).
 * - Khoá / mở khoá: PATCH /users/{id}/status; không tự khoá chính mình (403).
 */

import {FormEvent, useCallback, useEffect, useMemo, useState} from "react";

import {Icon} from "@/components/admin/Icon";
import {useAdmin} from "@/components/admin/Shell";
import {
  EmptyState,
  Field,
  FilterSelect,
  Modal,
  Notice,
  PageHeader,
  Pager,
  Panel,
  Pill,
  SearchBox,
  TableSkeleton,
  useConfirm,
  usePaged,
} from "@/components/admin/ui";
import {api, ApiError, formatDate} from "@/lib/api";
import {fold} from "@/lib/format";

interface AccountRow {
  id: string;
  username: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  region: string | null;
  role: string;
  is_active: boolean;
  created_at: number;
}

interface CreateForm {
  username: string;
  password: string;
  full_name: string;
  phone: string;
  region: string;
  role: "farmer" | "admin";
}

const EMPTY_FORM: CreateForm = {username: "", password: "", full_name: "", phone: "", region: "", role: "farmer"};

export default function AccountsPage() {
  const {me, isAdmin} = useAdmin();
  const [accounts, setAccounts] = useState<AccountRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [creating, setCreating] = useState(false);
  const {confirm, dialog} = useConfirm();

  const load = useCallback(async () => {
    try {
      setAccounts(await api<AccountRow[]>("/users"));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    // `load` chỉ setState sau khi yêu cầu mạng trả về.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isAdmin) void load();
  }, [isAdmin, load]);

  const filtered = useMemo(() => {
    const q = fold(query.trim());
    return (accounts ?? [])
      .filter(a => (role === "all" ? true : a.role === role))
      .filter(a => (status === "all" ? true : status === "active" ? a.is_active : !a.is_active))
      .filter(a => !q || fold(`${a.full_name} ${a.username} ${a.email ?? ""} ${a.phone ?? ""} ${a.region ?? ""}`).includes(q));
  }, [accounts, query, role, status]);

  const paged = usePaged(filtered, 10);

  async function toggleStatus(account: AccountRow) {
    if (busyId) return;
    const nextActive = !account.is_active;
    const action = nextActive ? "mở khoá" : "khoá";
    const ok = await confirm({
      title: nextActive ? "Mở khoá tài khoản" : "Khoá tài khoản",
      message: nextActive
        ? `Mở khoá “${account.full_name}” (${account.username})? Họ sẽ đăng nhập lại được ngay.`
        : `Khoá “${account.full_name}” (${account.username})? Họ không đăng nhập được cho tới khi bạn mở khoá; dữ liệu đã ghi vẫn được giữ.`,
      confirmLabel: nextActive ? "Mở khoá" : "Khoá tài khoản",
      danger: !nextActive,
    });
    if (!ok) return;
    setBusyId(account.id);
    setNote(null);
    try {
      const updated = await api<AccountRow>(`/users/${account.id}/status`, {method: "PATCH", body: JSON.stringify({is_active: nextActive})});
      setAccounts(prev => (prev ?? []).map(a => (a.id === updated.id ? {...a, is_active: updated.is_active} : a)));
      setNote(`Đã ${action} tài khoản “${account.username}”`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Không thực hiện được");
    } finally {
      setBusyId(null);
    }
  }

  if (!isAdmin) return <Notice>Trang này chỉ dành cho quản trị viên.</Notice>;

  const farmers = (accounts ?? []).filter(a => a.role === "farmer").length;

  return (
    <>
      <PageHeader
        title="Tài khoản"
        subtitle={accounts ? `${accounts.length} tài khoản · ${farmers} nông hộ · ${accounts.length - farmers} quản trị viên` : "Đang tải…"}
        actions={
          <button className="btn btn-primary" type="button" onClick={() => setCreating(true)}>
            <Icon name="plus" size={16} />
            Tạo tài khoản
          </button>
        }
      />
      {error ? <Notice>{error}</Notice> : null}
      {note ? <Notice tone="green">{note}</Notice> : null}

      <Panel flush>
        <div className="toolbar">
          <SearchBox value={query} onChange={setQuery} placeholder="Tìm theo tên, tài khoản, email, điện thoại, địa chỉ…" label="Tìm tài khoản" />
          <FilterSelect
            label="Vai trò"
            value={role}
            onChange={setRole}
            options={[
              {value: "all", label: "Tất cả"},
              {value: "farmer", label: "Nông hộ"},
              {value: "admin", label: "Quản trị viên"},
            ]}
          />
          <FilterSelect
            label="Trạng thái"
            value={status}
            onChange={setStatus}
            options={[
              {value: "all", label: "Tất cả"},
              {value: "active", label: "Đang hoạt động"},
              {value: "locked", label: "Đã khoá"},
            ]}
          />
        </div>

        {accounts === null && !error ? (
          <TableSkeleton rows={8} cols={5} />
        ) : filtered.length === 0 ? (
          <EmptyState icon="accounts" title="Không có tài khoản nào khớp" hint="Thử đổi từ khoá hoặc bỏ bộ lọc." />
        ) : (
          <>
            <div className="data-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Họ tên</th>
                    <th>Tên đăng nhập</th>
                    <th>Liên hệ</th>
                    <th>Vai trò</th>
                    <th>Trạng thái</th>
                    <th aria-label="Thao tác" />
                  </tr>
                </thead>
                <tbody>
                  {paged.slice.map(a => (
                    <tr key={a.id} style={{opacity: busyId === a.id ? 0.5 : 1}}>
                      <td>
                        <span className="cell-main">{a.full_name}</span>
                        <span className="cell-sub">{a.region ?? "—"}</span>
                      </td>
                      <td className="mono">{a.username}</td>
                      <td>
                        <span className="cell-main" style={{fontWeight: 600}}>
                          {a.phone ?? "—"}
                        </span>
                        <span className="cell-sub">{a.email ?? "—"}</span>
                      </td>
                      <td>
                        <Pill tone={a.role === "admin" ? "blue" : "green"}>{a.role === "admin" ? "Quản trị viên" : "Nông hộ"}</Pill>
                      </td>
                      <td>
                        <Pill tone={a.is_active ? "green" : "gray"}>{a.is_active ? "Hoạt động" : "Đã khoá"}</Pill>
                        <span className="cell-sub">Tạo ngày {formatDate(a.created_at)}</span>
                      </td>
                      <td>
                        {a.id !== me.id ? (
                          <div className="cell-actions">
                            <button
                              className={a.is_active ? "btn btn-danger btn-sm" : "btn btn-secondary btn-sm"}
                              type="button"
                              disabled={busyId !== null}
                              onClick={() => toggleStatus(a)}
                              aria-label={`${a.is_active ? "Khoá" : "Mở khoá"} ${a.username}`}
                            >
                              <Icon name="lock" size={14} />
                              {a.is_active ? "Khoá" : "Mở khoá"}
                            </button>
                          </div>
                        ) : (
                          <span className="muted small" style={{display: "block", textAlign: "right"}}>
                            Tài khoản của bạn
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager {...paged} onPage={paged.setPage} noun="tài khoản" />
          </>
        )}
      </Panel>

      {creating ? (
        <CreateAccount
          onClose={() => setCreating(false)}
          onCreated={async account => {
            setCreating(false);
            setNote(`Đã tạo tài khoản “${account.username}”`);
            await load();
          }}
        />
      ) : null}
      {dialog}
    </>
  );
}

function CreateAccount({onClose, onCreated}: {onClose: () => void; onCreated: (account: AccountRow) => Promise<void>}) {
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof CreateForm>(key: K, value: CreateForm[K]) => setForm(f => ({...f, [key]: value}));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const account = await api<AccountRow>("/users", {
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
      await onCreated(account);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không tạo được tài khoản");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Tạo tài khoản mới"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" type="button" onClick={onClose}>
            Huỷ
          </button>
          <button className="btn btn-primary" type="submit" form="account-form" disabled={busy}>
            {busy ? "Đang tạo…" : "Tạo tài khoản"}
          </button>
        </>
      }
    >
      <form id="account-form" onSubmit={submit}>
        <div className="form-grid-2">
          <Field label="Tên đăng nhập" htmlFor="acc-username" hint="Từ 3 ký tự, không dấu, không khoảng trắng.">
            <input id="acc-username" required minLength={3} maxLength={64} value={form.username} onChange={e => set("username", e.target.value)} placeholder="ví dụ: tranquochung" autoComplete="off" />
          </Field>
          <Field label="Mật khẩu" htmlFor="acc-password" hint="Tối thiểu 6 ký tự.">
            <input id="acc-password" type="password" required minLength={6} maxLength={128} value={form.password} onChange={e => set("password", e.target.value)} autoComplete="new-password" />
          </Field>
        </div>
        <Field label="Họ và tên" htmlFor="acc-name">
          <input id="acc-name" required maxLength={128} value={form.full_name} onChange={e => set("full_name", e.target.value)} placeholder="ví dụ: Trần Quốc Hưng" />
        </Field>
        <div className="form-grid-2">
          <Field label="Số điện thoại" htmlFor="acc-phone">
            <input id="acc-phone" type="tel" maxLength={32} value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="ví dụ: 0987215463" />
          </Field>
          <Field label="Vai trò" htmlFor="acc-role">
            <select id="acc-role" value={form.role} onChange={e => set("role", e.target.value as "farmer" | "admin")}>
              <option value="farmer">Nông hộ</option>
              <option value="admin">Quản trị viên</option>
            </select>
          </Field>
        </div>
        <Field label="Địa chỉ" htmlFor="acc-region">
          <input id="acc-region" maxLength={128} value={form.region} onChange={e => set("region", e.target.value)} placeholder="ví dụ: Đa Thiện, phường Lâm Viên - Đà Lạt, Lâm Đồng" />
        </Field>
        {error ? (
          <div style={{marginTop: 16}}>
            <Notice>{error}</Notice>
          </div>
        ) : null}
      </form>
    </Modal>
  );
}
