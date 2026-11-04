"use client";

/**
 * Khung của trang quản trị: thanh điều hướng bên trái, thanh trên cùng, kiểm
 * tra phiên đăng nhập. Mọi trang trong nhóm `(admin)` nằm trong khung này nên
 * không trang nào phải tự chép lại hàng nút điều hướng nữa.
 *
 * Quản trị viên thấy đủ các mục; nông hộ chỉ thấy sổ sách của mình và cài đặt.
 * Việc ẩn mục chỉ để gọn giao diện — quyền thật nằm ở backend (403).
 */

import Link from "next/link";
import {usePathname, useRouter} from "next/navigation";
import {createContext, ReactNode, useContext, useEffect, useState} from "react";

import {api, API_URL, ApiError, getToken, setToken, type SessionUser} from "@/lib/api";

import {Icon, type IconName} from "./Icon";

interface AdminContextValue {
  me: SessionUser;
  isAdmin: boolean;
  signOut: () => void;
}

const AdminContext = createContext<AdminContextValue | null>(null);

export function useAdmin(): AdminContextValue {
  const value = useContext(AdminContext);
  if (!value) throw new Error("useAdmin phải nằm trong <AdminShell>");
  return value;
}

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  badgeKey?: "pending_varieties" | "errors_30d";
}

const ADMIN_NAV: {group: string; items: NavItem[]}[] = [
  {
    group: "Quản lý",
    items: [
      {href: "/dashboard", label: "Tổng quan", icon: "overview"},
      {href: "/farms", label: "Nông hộ", icon: "farms"},
      {href: "/plots", label: "Lô đất", icon: "plots"},
    ],
  },
  {
    group: "Dữ liệu dùng chung",
    items: [
      {href: "/varieties", label: "Duyệt giống cây", icon: "varieties", badgeKey: "pending_varieties"},
      {href: "/care-guides", label: "Hướng dẫn chăm sóc", icon: "guides"},
      {href: "/fertilizer-prices", label: "Giá phân bón", icon: "prices"},
    ],
  },
  {
    group: "Hệ thống",
    items: [
      {href: "/accounts", label: "Tài khoản", icon: "accounts"},
      {href: "/logs", label: "Nhật ký lỗi", icon: "logs", badgeKey: "errors_30d"},
      {href: "/settings", label: "Cài đặt", icon: "settings"},
    ],
  },
];

const FARMER_NAV: {group: string; items: NavItem[]}[] = [
  {
    group: "Của tôi",
    items: [
      {href: "/dashboard", label: "Sổ sách của tôi", icon: "wallet"},
      {href: "/settings", label: "Cài đặt", icon: "settings"},
    ],
  },
];

type Health = "checking" | "ok" | "down";

export function AdminShell({children}: {children: ReactNode}) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<SessionUser | null>(null);
  const [badges, setBadges] = useState<Partial<Record<NonNullable<NavItem["badgeKey"]>, number>>>({});
  const [health, setHealth] = useState<Health>("checking");
  const [navOpen, setNavOpen] = useState(false);

  // Phiên đăng nhập: không có token hoặc token hết hạn thì về trang đăng nhập.
  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    api<SessionUser>("/auth/me")
      .then(user => {
        setMe(user);
        if (user.role === "admin") {
          api<{pending_varieties: number; errors_30d: number}>("/admin/overview?months=1")
            .then(o => setBadges({pending_varieties: o.pending_varieties, errors_30d: o.errors_30d}))
            .catch(() => undefined);
        }
      })
      .catch(e => {
        if (e instanceof ApiError && e.status === 401) router.replace("/login");
        else setHealth("down");
      });
  }, [router]);

  // Nhịp kiểm tra máy chủ mỗi 30 giây, để người trực biết ngay khi API ngừng.
  useEffect(() => {
    let alive = true;
    const ping = () =>
      fetch(`${API_URL}/health`)
        .then(r => r.json())
        .then(body => alive && setHealth(body.status === "ok" ? "ok" : "down"))
        .catch(() => alive && setHealth("down"));
    ping();
    const timer = setInterval(ping, 30_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  // Đóng ngăn điều hướng (màn hình hẹp) mỗi khi đổi trang.
  useEffect(() => {
    const id = requestAnimationFrame(() => setNavOpen(false));
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  const signOut = () => {
    setToken(null);
    router.replace("/login");
  };

  if (!me) {
    return (
      <div className="shell shell-loading">
        <p className="muted">Đang tải…</p>
      </div>
    );
  }

  const isAdmin = me.role === "admin";
  const nav = isAdmin ? ADMIN_NAV : FARMER_NAV;
  const initials = me.full_name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map(w => w[0])
    .join("")
    .toUpperCase();

  return (
    <AdminContext.Provider value={{me, isAdmin, signOut}}>
      <div className="shell admin-shell">
        <aside className={navOpen ? "sidebar sidebar-open" : "sidebar"} aria-label="Điều hướng chính">
          <div className="sidebar-brand">
            <span className="brand-mark" aria-hidden>
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path d="M12 22C12 13 16 4 22 2c0 10-4 18-10 20Z" fill="var(--color-green-300)" />
                <path d="M12 22C12 14 8 6 2 5c0 9 4 16 10 17Z" fill="var(--color-white)" />
              </svg>
            </span>
            <div>
              <span className="sidebar-brand-name">AgriLog</span>
              <span className="sidebar-brand-sub">{isAdmin ? "Trang quản trị" : "Sổ sách nông hộ"}</span>
            </div>
          </div>

          <nav className="sidebar-nav">
            {nav.map(section => (
              <div className="nav-section" key={section.group}>
                <p className="nav-heading">{section.group}</p>
                {section.items.map(item => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const count = item.badgeKey ? badges[item.badgeKey] : undefined;
                  return (
                    <Link key={item.href} href={item.href} className={active ? "nav-item nav-item-active" : "nav-item"} aria-current={active ? "page" : undefined}>
                      <Icon name={item.icon} />
                      <span className="nav-label">{item.label}</span>
                      {count ? <span className="nav-badge">{count > 99 ? "99+" : count}</span> : null}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className="sidebar-user">
            <span className="avatar" aria-hidden>
              {initials || "?"}
            </span>
            <div className="sidebar-user-text">
              <span className="sidebar-user-name">{me.full_name}</span>
              <span className="sidebar-user-role">{isAdmin ? "Quản trị viên" : "Nông hộ"}</span>
            </div>
            <button type="button" className="sidebar-signout" onClick={signOut} aria-label="Đăng xuất" title="Đăng xuất">
              <Icon name="logout" />
            </button>
          </div>
        </aside>

        {navOpen ? <div className="sidebar-scrim" onClick={() => setNavOpen(false)} aria-hidden /> : null}

        <div className="main">
          <div className="topbar-shell">
            <button type="button" className="icon-btn menu-btn" onClick={() => setNavOpen(true)} aria-label="Mở menu">
              <Icon name="menu" />
            </button>
            <div className="topbar-spacer" />
            <span className={`health health-${health}`} role="status">
              <span className="health-dot" aria-hidden />
              {health === "ok" ? "Máy chủ hoạt động" : health === "down" ? "Không kết nối được máy chủ" : "Đang kiểm tra…"}
            </span>
          </div>
          <main className="content">{children}</main>
        </div>
      </div>
    </AdminContext.Provider>
  );
}
