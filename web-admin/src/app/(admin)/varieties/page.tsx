"use client";

/**
 * Duyệt giống cây — the variety list is an "open catalogue": a farmer can add
 * their own variety from the phone, and it stays "chờ duyệt" until an admin
 * approves or rejects it here. Varieties from the sourced catalogue (is_seed)
 * have nothing to review; they are listed under "Danh mục gốc" for reference.
 */

import {useEffect, useMemo, useState} from "react";

import {useAdmin} from "@/components/AdminShell";
import {IconCheck, IconLeaf, IconSearch, IconSprout, IconTrash} from "@/components/icons";
import {EmptyState, PageHeader, Panel, Segmented, Skeleton, StatCard, Toast} from "@/components/ui";
import {api, ApiError} from "@/lib/api";

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

type Tab = "pending" | "approved" | "seed";

const dateLabel = (ms: number) => new Date(ms).toLocaleDateString("vi-VN", {day: "2-digit", month: "2-digit", year: "numeric"});

export default function VarietiesPage() {
  const {farms, me} = useAdmin();
  const [varieties, setVarieties] = useState<Variety[] | null>(null);
  const [tab, setTab] = useState<Tab>("pending");
  const [crop, setCrop] = useState("all");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{message: string; tone?: "green" | "red"} | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () =>
    api<Variety[]>("/crop-varieties")
      .then(setVarieties)
      .catch(e => setError(e instanceof Error ? e.message : String(e)));

  useEffect(() => {
    void load();
  }, []);

  const submitter = useMemo(() => {
    const byId = new Map(farms.map(u => [u.id, u.full_name || u.username]));
    byId.set(me.id, me.full_name || me.username);
    return (id: string | null) => (id ? (byId.get(id) ?? "Quản trị viên") : "—");
  }, [farms, me]);

  const all = varieties ?? [];
  const added = all.filter(v => !v.is_seed);
  const counts = {
    pending: added.filter(v => !v.approved).length,
    approved: added.filter(v => v.approved).length,
    seed: all.filter(v => v.is_seed).length,
    crops: new Set(all.filter(v => v.is_seed).map(v => v.crop_type)).size,
  };

  const crops = useMemo(() => {
    const names = new Map<string, string>();
    for (const v of varieties ?? []) names.set(v.crop_type, v.crop_name);
    return [...names.entries()].sort((a, b) => a[1].localeCompare(b[1], "vi"));
  }, [varieties]);

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("vi");
    return (varieties ?? [])
      .filter(v => (tab === "seed" ? v.is_seed : !v.is_seed && v.approved === (tab === "approved")))
      .filter(v => crop === "all" || v.crop_type === crop)
      .filter(v => !q || [v.name, v.crop_name, v.category_name ?? "", v.description ?? ""].some(s => s.toLocaleLowerCase("vi").includes(q)))
      .sort((a, b) => (tab === "seed" ? a.crop_name.localeCompare(b.crop_name, "vi") || a.name.localeCompare(b.name, "vi") : b.created_at - a.created_at));
  }, [varieties, tab, crop, query]);

  const review = async (variety: Variety, approved: boolean) => {
    setBusyId(variety.id);
    try {
      await api<Variety>(`/crop-varieties/${variety.id}`, {method: "PATCH", body: JSON.stringify({approved})});
      setToast({message: approved ? `Đã duyệt "${variety.name}" — mọi nông hộ thấy giống này sau lần đồng bộ tới` : `Đã bỏ duyệt "${variety.name}"`});
      await load();
    } catch (e) {
      setToast({message: e instanceof ApiError ? e.message : "Không cập nhật được giống cây", tone: "red"});
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (variety: Variety) => {
    if (!window.confirm(`Từ chối và xoá giống "${variety.name}" khỏi danh mục? Không thể hoàn tác.`)) return;
    setBusyId(variety.id);
    try {
      await api<void>(`/crop-varieties/${variety.id}`, {method: "DELETE"});
      setToast({message: `Đã từ chối "${variety.name}"`});
      await load();
    } catch (e) {
      setToast({message: e instanceof ApiError ? e.message : "Không xoá được giống cây", tone: "red"});
    } finally {
      setBusyId(null);
    }
  };

  const placeholder = <Skeleton height={28} width={48} />;

  return (
    <main className="page">
      <PageHeader
        title="Duyệt giống cây"
        subtitle="Nông hộ thêm giống của mình trên điện thoại; giống mới chờ ở đây cho tới khi được duyệt thì mới hiện cho các hộ khác."
      />
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid grid-kpi">
        <StatCard label="Chờ duyệt" tone={counts.pending > 0 ? "amber" : "gray"} icon={<IconSprout size={22} />} value={varieties ? counts.pending : placeholder} sub="Do nông hộ thêm" />
        <StatCard label="Đã duyệt" tone="green" icon={<IconCheck size={22} />} value={varieties ? counts.approved : placeholder} sub="Giống nông hộ thêm, đang dùng chung" />
        <StatCard label="Danh mục gốc" tone="blue" icon={<IconLeaf size={22} />} value={varieties ? counts.seed : placeholder} sub={`${counts.crops} loại cây, có nguồn trích dẫn`} />
        <StatCard label="Nông hộ đóng góp" tone="lime" icon={<IconSprout size={22} />} value={varieties ? new Set(added.map(v => v.created_by)).size : placeholder} sub={`/ ${farms.length} nông hộ`} />
      </div>

      <Panel
        title={tab === "pending" ? "Giống chờ duyệt" : tab === "approved" ? "Giống nông hộ thêm đã duyệt" : "Danh mục gốc"}
        subtitle={tab === "seed" ? "Từ các nguồn đã trích dẫn trong shared/data — không cần duyệt." : undefined}
        action={
          <div className="toolbar">
            <Segmented<Tab>
              label="Nhóm giống"
              value={tab}
              onChange={setTab}
              options={[
                {value: "pending", label: `Chờ duyệt ${counts.pending}`},
                {value: "approved", label: `Đã duyệt ${counts.approved}`},
                {value: "seed", label: `Danh mục gốc ${counts.seed}`},
              ]}
            />
            <select className="input" value={crop} onChange={e => setCrop(e.target.value)} aria-label="Loại cây">
              <option value="all">Mọi loại cây</option>
              {crops.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
            <label className="search">
              <IconSearch size={18} />
              <input className="input" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm giống" aria-label="Tìm giống" />
            </label>
          </div>
        }
        flush>
        {varieties == null ? (
          <div className="panel-body">
            <Skeleton height={180} />
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<IconSprout />}
            title={tab === "pending" && !query && crop === "all" ? "Không có giống nào chờ duyệt" : "Không có giống nào khớp"}
            body={tab === "pending" && !query && crop === "all" ? "Khi nông hộ thêm giống mới trên điện thoại và đồng bộ, giống đó sẽ hiện ở đây." : "Thử bỏ bớt bộ lọc hoặc từ tìm kiếm."}
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Giống</th>
                  <th>Cây / nhóm</th>
                  {tab === "seed" ? null : (
                    <>
                      <th>Người thêm</th>
                      <th>Ngày thêm</th>
                      <th aria-label="Thao tác" />
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {visible.map(v => (
                  <tr key={v.id}>
                    <td className="wrap" style={{maxWidth: 420}}>
                      <div className="cell-main">{v.name}</div>
                      {v.description ? <div className="cell-sub">{v.description}</div> : null}
                    </td>
                    <td>
                      <div>{v.crop_name}</div>
                      {v.category_name ? <div className="cell-sub">{v.category_name}</div> : null}
                    </td>
                    {tab === "seed" ? null : (
                      <>
                        <td>{submitter(v.created_by)}</td>
                        <td>{dateLabel(v.created_at)}</td>
                        <td>
                          <div className="row-actions" style={{justifyContent: "flex-end"}}>
                            {v.approved ? (
                              <button className="btn btn-secondary btn-sm" type="button" disabled={busyId === v.id} onClick={() => review(v, false)}>
                                Bỏ duyệt
                              </button>
                            ) : (
                              <button className="btn btn-primary btn-sm" type="button" disabled={busyId === v.id} onClick={() => review(v, true)}>
                                <IconCheck size={16} /> Duyệt
                              </button>
                            )}
                            <button className="btn btn-danger btn-sm" type="button" disabled={busyId === v.id} onClick={() => reject(v)} aria-label={`Từ chối ${v.name}`} title="Từ chối và xoá">
                              <IconTrash size={16} />
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      {toast ? <Toast message={toast.message} tone={toast.tone} onDone={() => setToast(null)} /> : null}
    </main>
  );
}
