"use client";

/**
 * Duyệt giống cây trồng — danh mục giống là "open catalogue": nông hộ có thể
 * thêm giống của mình từ ứng dụng, giống đó vào hệ thống ở trạng thái "chưa duyệt"
 * cho tới khi một quản trị viên duyệt hoặc từ chối tại đây. Giống trong danh
 * mục gốc (is_seed) không có gì để duyệt nên không xuất hiện ở trang này.
 */

import {useCallback, useEffect, useMemo, useState} from "react";

import {useAdmin} from "@/components/admin/Shell";
import {
  EmptyState,
  FilterSelect,
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
}

export default function VarietiesPage() {
  const {isAdmin} = useAdmin();
  const [varieties, setVarieties] = useState<Variety[] | null>(null);
  const [users, setUsers] = useState<FarmUser[]>([]);
  const [state, setState] = useState("pending");
  const [crop, setCrop] = useState("all");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const {confirm, dialog} = useConfirm();

  const submitterName = useMemo(() => {
    const byId = new Map(users.map(u => [u.id, u.full_name || u.username]));
    return (id: string | null) => (id ? (byId.get(id) ?? id) : "—");
  }, [users]);

  const load = useCallback(async () => {
    try {
      const [rows, list] = await Promise.all([api<Variety[]>("/crop-varieties"), api<FarmUser[]>("/users")]);
      setVarieties(rows.filter(v => !v.is_seed));
      setUsers(list);
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

  const cropOptions = useMemo(() => {
    const seen = new Map<string, string>();
    (varieties ?? []).forEach(v => seen.set(v.crop_type, v.crop_name));
    return [{value: "all", label: "Mọi loại cây"}, ...[...seen].map(([value, label]) => ({value, label}))];
  }, [varieties]);

  const visible = useMemo(() => {
    const q = fold(query.trim());
    return (varieties ?? [])
      .filter(v => (state === "all" ? true : state === "pending" ? !v.approved : v.approved))
      .filter(v => (crop === "all" ? true : v.crop_type === crop))
      .filter(v => !q || fold(`${v.name} ${v.crop_name} ${v.category_name ?? ""} ${submitterName(v.created_by)}`).includes(q))
      .sort((a, b) => b.created_at - a.created_at);
  }, [varieties, state, crop, query, submitterName]);

  const paged = usePaged(visible, 10);

  const review = async (variety: Variety, approved: boolean) => {
    setBusyId(variety.id);
    setError(null);
    setNote(null);
    try {
      await api<Variety>(`/crop-varieties/${variety.id}`, {method: "PATCH", body: JSON.stringify({approved})});
      setNote(approved ? `Đã duyệt “${variety.name}” — hiện trong danh mục của mọi nông hộ` : `Đã bỏ duyệt “${variety.name}”`);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Không cập nhật được giống cây");
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (variety: Variety) => {
    const ok = await confirm({
      title: "Từ chối giống cây",
      message: `Xoá giống “${variety.name}” khỏi danh mục? Nông hộ đã đề xuất sẽ không còn thấy giống này sau lần đồng bộ tới.`,
      confirmLabel: "Từ chối và xoá",
      danger: true,
    });
    if (!ok) return;
    setBusyId(variety.id);
    setError(null);
    setNote(null);
    try {
      await api<void>(`/crop-varieties/${variety.id}`, {method: "DELETE"});
      setNote(`Đã từ chối “${variety.name}”`);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Không xoá được giống cây");
    } finally {
      setBusyId(null);
    }
  };

  if (!isAdmin) return <Notice>Trang này chỉ dành cho quản trị viên.</Notice>;

  const pendingCount = (varieties ?? []).filter(v => !v.approved).length;

  return (
    <>
      <PageHeader
        title="Duyệt giống cây trồng"
        subtitle={varieties ? (pendingCount > 0 ? `${pendingCount} giống do nông hộ thêm đang chờ duyệt` : "Không có giống nào đang chờ duyệt") : "Đang tải…"}
      />
      {error ? <Notice>{error}</Notice> : null}
      {note ? <Notice tone="green">{note}</Notice> : null}

      <Panel flush>
        <div className="toolbar">
          <SearchBox value={query} onChange={setQuery} placeholder="Tìm theo tên giống, loại cây, người gửi…" label="Tìm giống cây" />
          <FilterSelect label="Loại cây" value={crop} onChange={setCrop} options={cropOptions} />
          <FilterSelect
            label="Trạng thái"
            value={state}
            onChange={setState}
            options={[
              {value: "pending", label: "Chờ duyệt"},
              {value: "approved", label: "Đã duyệt"},
              {value: "all", label: "Tất cả"},
            ]}
          />
        </div>

        {varieties === null && !error ? (
          <TableSkeleton rows={5} cols={5} />
        ) : visible.length === 0 ? (
          <EmptyState
            icon="varieties"
            title={state === "pending" ? "Không có giống nào chờ duyệt" : "Không có giống nào khớp bộ lọc"}
            hint="Khi nông hộ thêm giống riêng trong ứng dụng, giống đó hiện ở đây để bạn duyệt trước khi dùng chung."
          />
        ) : (
          <>
            <div className="data-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tên giống</th>
                    <th>Cây / loại con</th>
                    <th>Người gửi</th>
                    <th>Ngày gửi</th>
                    <th>Trạng thái</th>
                    <th aria-label="Thao tác" />
                  </tr>
                </thead>
                <tbody>
                  {paged.slice.map(v => (
                    <tr key={v.id}>
                      <td>
                        <span className="cell-main">{v.name}</span>
                        {v.description ? <span className="cell-sub">{v.description}</span> : null}
                      </td>
                      <td>
                        <span className="cell-main" style={{fontWeight: 600}}>
                          {v.crop_name}
                        </span>
                        <span className="cell-sub">{v.category_name ?? "—"}</span>
                      </td>
                      <td>{submitterName(v.created_by)}</td>
                      <td className="nowrap">{formatDate(v.created_at)}</td>
                      <td>
                        <Pill tone={v.approved ? "green" : "amber"}>{v.approved ? "Đã duyệt" : "Chờ duyệt"}</Pill>
                      </td>
                      <td>
                        <div className="cell-actions">
                          {v.approved ? (
                            <button className="btn btn-secondary btn-sm" type="button" disabled={busyId === v.id} onClick={() => review(v, false)}>
                              Bỏ duyệt
                            </button>
                          ) : (
                            <button className="btn btn-primary btn-sm" type="button" disabled={busyId === v.id} onClick={() => review(v, true)}>
                              Duyệt
                            </button>
                          )}
                          <button className="btn btn-danger btn-sm" type="button" disabled={busyId === v.id} onClick={() => reject(v)}>
                            Từ chối
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager {...paged} onPage={paged.setPage} noun="giống" />
          </>
        )}
      </Panel>
      {dialog}
    </>
  );
}
