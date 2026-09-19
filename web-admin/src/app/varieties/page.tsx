"use client";

/**
 * Duyệt giống cây trồng — danh mục giống là "open catalogue": nông dân có thể
 * thêm giống của mình từ app, giống đó vào hệ thống ở trạng thái "chưa duyệt"
 * cho tới khi một quản trị viên duyệt hoặc từ chối tại đây. Giống trong danh
 * mục gốc (is_seed) không có gì để duyệt nên không xuất hiện ở trang này.
 */

import Link from "next/link";
import {useRouter} from "next/navigation";
import {useEffect, useMemo, useState} from "react";

import {api, ApiError, getToken, type SessionUser} from "@/lib/api";

interface Variety {
  id: string;
  name: string;
  crop_type: string;
  crop_name: string;
  category_id: string | null;
  category_name: string | null;
  description: string | null;
  is_seed: boolean;
  approved: boolean;
  source: string;
  created_by: string | null;
  created_at: number;
}

interface FarmUser {
  id: string;
  username: string;
  full_name: string;
  region: string | null;
  role: string;
}

const dateLabel = (ms: number) => new Date(ms).toLocaleDateString("vi-VN", {day: "2-digit", month: "2-digit", year: "numeric"});

export default function VarietiesPage() {
  const router = useRouter();
  const [me, setMe] = useState<SessionUser | null>(null);
  const [varieties, setVarieties] = useState<Variety[]>([]);
  const [users, setUsers] = useState<FarmUser[]>([]);
  const [onlyPending, setOnlyPending] = useState(true);
  const [cropFilter, setCropFilter] = useState<string>("all");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const submitterName = useMemo(() => {
    const byId = new Map(users.map(u => [u.id, u.full_name || u.username]));
    return (id: string | null) => (id ? (byId.get(id) ?? id) : "—");
  }, [users]);

  const load = () =>
    api<Variety[]>("/crop-varieties").then(rows => setVarieties(rows.filter(v => !v.is_seed)));

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    api<SessionUser>("/auth/me")
      .then(async user => {
        if (user.role !== "admin") {
          router.replace("/dashboard");
          return;
        }
        setMe(user);
        const [, list] = await Promise.all([load(), api<FarmUser[]>("/users")]);
        setUsers(list);
      })
      .catch(e => {
        if (e instanceof ApiError && e.status === 401) router.replace("/login");
        else setError(e instanceof Error ? e.message : String(e));
      });
  }, [router]);

  const cropTypes = useMemo(
    () => Array.from(new Set(varieties.map(v => v.crop_type))).sort(),
    [varieties],
  );

  const visible = varieties
    .filter(v => (onlyPending ? !v.approved : true))
    .filter(v => (cropFilter === "all" ? true : v.crop_type === cropFilter))
    .sort((a, b) => b.created_at - a.created_at);

  const review = async (variety: Variety, approved: boolean) => {
    setBusyId(variety.id);
    setError(null);
    setNote(null);
    try {
      await api<Variety>(`/crop-varieties/${variety.id}`, {
        method: "PATCH",
        body: JSON.stringify({approved}),
      });
      setNote(approved ? `Đã duyệt "${variety.name}"` : `Đã bỏ duyệt "${variety.name}"`);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Không cập nhật được giống cây");
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (variety: Variety) => {
    if (!window.confirm(`Xoá giống "${variety.name}" khỏi danh mục? Không thể hoàn tác.`)) return;
    setBusyId(variety.id);
    setError(null);
    setNote(null);
    try {
      await api<void>(`/crop-varieties/${variety.id}`, {method: "DELETE"});
      setNote(`Đã từ chối "${variety.name}"`);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Không xoá được giống cây");
    } finally {
      setBusyId(null);
    }
  };

  if (!me) {
    return (
      <main className="page">
        <p className="muted">{error ?? "Đang tải…"}</p>
      </main>
    );
  }

  const pendingCount = varieties.filter(v => !v.approved).length;

  return (
    <main className="page">
      <header className="topbar">
        <div>
          <p className="eyebrow">AgriLog v2 · Quản trị</p>
          <h1 className="title">Duyệt giống cây trồng</h1>
          <p className="muted">
            {pendingCount > 0 ? `${pendingCount} giống do nông hộ thêm đang chờ duyệt` : "Không có giống nào đang chờ duyệt"}
          </p>
        </div>
        <div className="topbar-actions">
          <Link className="btn btn-secondary" href="/dashboard">
            Quay lại dashboard
          </Link>
        </div>
      </header>

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {note ? <p className="muted small">{note}</p> : null}

      <div className="card">
        <div className="row-between">
          <div className="period" role="group" aria-label="Bộ lọc">
            <select className="input" value={cropFilter} onChange={e => setCropFilter(e.target.value)} aria-label="Loại cây">
              <option value="all">Mọi loại cây</option>
              {cropTypes.map(c => (
                <option key={c} value={c}>
                  {varieties.find(v => v.crop_type === c)?.crop_name ?? c}
                </option>
              ))}
            </select>
            <label className="label inline" style={{minWidth: "auto", flexDirection: "row", alignItems: "center", gap: "8px"}}>
              <input type="checkbox" checked={onlyPending} onChange={e => setOnlyPending(e.target.checked)} />
              Chỉ hiện chờ duyệt
            </label>
          </div>
        </div>

        {visible.length === 0 ? (
          <p className="muted">Không có giống cây nào khớp bộ lọc.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Tên giống</th>
                  <th scope="col">Cây / Loại con</th>
                  <th scope="col">Người gửi</th>
                  <th scope="col">Ngày gửi</th>
                  <th scope="col">Trạng thái</th>
                  <th scope="col">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(v => (
                  <tr key={v.id}>
                    <td className="strong">{v.name}</td>
                    <td>
                      {v.crop_name}
                      {v.category_name ? ` · ${v.category_name}` : ""}
                    </td>
                    <td>{submitterName(v.created_by)}</td>
                    <td>{dateLabel(v.created_at)}</td>
                    <td>
                      <span className={v.approved ? "badge badge-green" : "badge badge-yellow"}>
                        {v.approved ? "Đã duyệt" : "Chờ duyệt"}
                      </span>
                    </td>
                    <td>
                      <div style={{display: "flex", gap: "8px", flexWrap: "wrap"}}>
                        {v.approved ? (
                          <button
                            className="btn btn-secondary"
                            type="button"
                            disabled={busyId === v.id}
                            onClick={() => review(v, false)}
                          >
                            Bỏ duyệt
                          </button>
                        ) : (
                          <button
                            className="btn btn-primary"
                            type="button"
                            disabled={busyId === v.id}
                            onClick={() => review(v, true)}
                          >
                            Duyệt
                          </button>
                        )}
                        <button
                          className="btn btn-danger"
                          type="button"
                          disabled={busyId === v.id}
                          onClick={() => reject(v)}
                        >
                          Từ chối
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
