"use client";

/**
 * The frame of every signed-in page: a sidebar grouped by job, a top bar with
 * where you are and the village weather, and the session itself.
 *
 * Signing in is checked here once for all pages. Admins see the whole
 * sidebar; a farmer who logs into the web sees only their own farm and their
 * account settings. Below 1024 px the sidebar becomes a drawer.
 */

import Link from "next/link";
import {usePathname, useRouter} from "next/navigation";
import {createContext, useCallback, useContext, useEffect, useMemo, useState} from "react";

import {
  IconAlert,
  IconBell,
  IconBook,
  IconClose,
  IconFarms,
  IconLeaf,
  IconLogout,
  IconMenu,
  IconOverview,
  IconPalette,
  IconPlots,
  IconPrice,
  IconSettings,
  IconSprout,
  IconUsers,
  IconWeather,
} from "@/components/icons";
import {WeatherGlyph} from "@/components/WeatherGlyph";
import {api, ApiError, getToken, setToken, type SessionUser} from "@/lib/api";
import {initialOf, longDate} from "@/lib/format";
import type {FarmUser, Forecast} from "@/lib/types";

interface AdminContextValue {
  me: SessionUser;
  isAdmin: boolean;
  /** Farmer accounts (admins only; empty for a farmer). */
  farms: FarmUser[];
  reloadFarms: () => Promise<void>;
  forecast: Forecast | null;
  setForecast: (f: Forecast) => void;
}

const AdminContext = createContext<AdminContextValue | null>(null);

export function useAdmin(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used inside <AdminShell>");
  return ctx;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const ADMIN_NAV: {title: string | null; items: NavItem[]}[] = [
  {title: null, items: [{href: "/dashboard", label: "Tổng quan", icon: <IconOverview />}]},
  {
    title: "Nông hộ & đất",
    items: [
      {href: "/farms", label: "Sổ sách nông hộ", icon: <IconFarms />},
      {href: "/plots", label: "Lô đất", icon: <IconPlots />},
      {href: "/accounts", label: "Tài khoản", icon: <IconUsers />},
    ],
  },
  {
    title: "Danh mục",
    items: [
      {href: "/varieties", label: "Duyệt giống cây", icon: <IconSprout />},
      {href: "/care-guides", label: "Hướng dẫn chăm sóc", icon: <IconBook />},
      {href: "/fertilizer-prices", label: "Giá phân bón", icon: <IconPrice />},
    ],
  },
  {
    title: "Thông tin tới nông hộ",
    items: [
      {href: "/notifications", label: "Thông báo", icon: <IconBell />},
      {href: "/weather", label: "Thời tiết", icon: <IconWeather />},
    ],
  },
  {
    title: "Hệ thống",
    items: [
      {href: "/logs", label: "Nhật ký lỗi", icon: <IconAlert />},
      {href: "/settings", label: "Cài đặt", icon: <IconSettings />},
      {href: "/tokens", label: "Hệ thiết kế", icon: <IconPalette />},
    ],
  },
];

const FARMER_NAV: {title: string | null; items: NavItem[]}[] = [
  {
    title: null,
    items: [
      {href: "/farms", label: "Trang trại của tôi", icon: <IconFarms />},
      {href: "/settings", label: "Cài đặt", icon: <IconSettings />},
    ],
  },
];

const FARMER_PAGES = ["/farms", "/settings"];

export function AdminShell({children}: {children: React.ReactNode}) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<SessionUser | null>(null);
  const [farms, setFarms] = useState<FarmUser[]>([]);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  // The drawer stays open only on the page it was opened from, so following
  // a link closes it.
  const [drawerOn, setDrawerOn] = useState<string | null>(null);
  const drawer = drawerOn === pathname;
  const setDrawer = (open: boolean) => setDrawerOn(open ? pathname : null);
  const [failure, setFailure] = useState<string | null>(null);

  const isAdmin = me?.role === "admin";

  const reloadFarms = useCallback(async () => {
    const list = await api<FarmUser[]>("/users");
    setFarms(list.filter(u => u.role === "farmer"));
  }, []);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    api<SessionUser>("/auth/me")
      .then(async user => {
        setMe(user);
        if (user.role === "admin") await reloadFarms();
      })
      .catch(e => {
        if (e instanceof ApiError && e.status === 401) router.replace("/login");
        else setFailure(e instanceof Error ? e.message : String(e));
      });
    api<Forecast>("/weather")
      .then(setForecast)
      .catch(() => undefined);
  }, [router, reloadFarms]);

  // A farmer only has their own farm and their account here.
  useEffect(() => {
    if (me && me.role !== "admin" && !FARMER_PAGES.some(p => pathname.startsWith(p))) router.replace("/farms");
  }, [me, pathname, router]);

  const nav = isAdmin ? ADMIN_NAV : FARMER_NAV;
  const current = useMemo(
    () => nav.flatMap(g => g.items).find(i => pathname === i.href || pathname.startsWith(`${i.href}/`)),
    [nav, pathname],
  );

  // Client pages cannot export metadata; the tab names the page here instead.
  useEffect(() => {
    if (current) document.title = `${current.label} · AgriLog Quản trị`;
  }, [current]);

  const signOut = () => {
    setToken(null);
    router.replace("/login");
  };

  const value = useMemo<AdminContextValue | null>(
    () => (me ? {me, isAdmin, farms, reloadFarms, forecast, setForecast} : null),
    [me, isAdmin, farms, reloadFarms, forecast],
  );

  if (failure) {
    return (
      <div className="shell-loading">
        <p className="error">Không tải được phiên đăng nhập: {failure}</p>
        <button className="btn btn-secondary" onClick={() => window.location.reload()}>
          Thử lại
        </button>
      </div>
    );
  }

  // A farmer on an admin page is on the way to /farms: render nothing that
  // would call admin-only endpoints meanwhile.
  const offLimits = me != null && me.role !== "admin" && !FARMER_PAGES.some(p => pathname.startsWith(p));

  if (!value || offLimits) {
    return (
      <div className="shell-loading" aria-busy="true">
        <span className="spinner" />
        <span className="muted">Đang tải…</span>
      </div>
    );
  }

  return (
    <AdminContext.Provider value={value}>
      <div className={`shell ${drawer ? "shell-drawer-open" : ""}`}>
        <aside className="sidebar" aria-label="Điều hướng">
          <div className="sidebar-brand">
            <span className="sidebar-logo">
              <IconLeaf size={22} />
            </span>
            <div>
              <div className="sidebar-name">AgriLog</div>
              <div className="sidebar-sub">{isAdmin ? "Quản trị · Làng hoa Vạn Thành" : "Nông hộ · Làng hoa Vạn Thành"}</div>
            </div>
            <button className="sidebar-close" aria-label="Đóng menu" onClick={() => setDrawer(false)}>
              <IconClose size={20} />
            </button>
          </div>

          <nav className="sidebar-nav">
            {nav.map((group, gi) => (
              <div key={gi} className="sidebar-group">
                {group.title ? <div className="sidebar-group-title">{group.title}</div> : null}
                {group.items.map(item => {
                  const active = current?.href === item.href;
                  return (
                    <Link key={item.href} href={item.href} className={`sidebar-link ${active ? "active" : ""}`} aria-current={active ? "page" : undefined}>
                      {item.icon}
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className="sidebar-user">
            <span className="avatar">{initialOf(me!.full_name || me!.username)}</span>
            <div className="sidebar-user-text">
              <div className="sidebar-user-name">{me!.full_name || me!.username}</div>
              <div className="sidebar-user-role">{isAdmin ? "Quản trị viên" : "Nông hộ"} · {me!.username}</div>
            </div>
            <button className="icon-btn icon-btn-dark" aria-label="Đăng xuất" title="Đăng xuất" onClick={signOut}>
              <IconLogout size={18} />
            </button>
          </div>
        </aside>
        <div className="sidebar-scrim" onClick={() => setDrawer(false)} aria-hidden="true" />

        <div className="shell-main">
          <header className="shell-topbar">
            <button className="icon-btn shell-menu" aria-label="Mở menu" onClick={() => setDrawer(true)}>
              <IconMenu size={22} />
            </button>
            <div className="crumbs">
              <span className="crumb-root">{isAdmin ? "Quản trị" : "AgriLog"}</span>
              <span className="crumb-sep">/</span>
              <span className="crumb-current">{current?.label ?? ""}</span>
            </div>
            <div className="topbar-right">
              <span className="topbar-date">{longDate()}</span>
              {forecast ? (
                <Link href={isAdmin ? "/weather" : "/farms"} className="weather-chip" title={`${forecast.place}: ${forecast.current.summary}`}>
                  <WeatherGlyph icon={forecast.current.icon} night={!forecast.current.is_day} size={26} />
                  <span className="weather-chip-temp">{forecast.current.temperature != null ? `${Math.round(forecast.current.temperature)}°` : "–"}</span>
                  <span className="weather-chip-place">Vạn Thành</span>
                </Link>
              ) : null}
              {isAdmin ? (
                <Link href="/notifications" className="icon-btn" aria-label="Thông báo" title="Thông báo">
                  <IconBell size={20} />
                </Link>
              ) : null}
            </div>
          </header>
          <div className="shell-content">{children}</div>
        </div>
      </div>
    </AdminContext.Provider>
  );
}
