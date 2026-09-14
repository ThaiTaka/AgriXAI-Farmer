"use client";

/**
 * Trang gốc: có phiên thì vào Dashboard, chưa có thì sang Đăng nhập.
 * Token nằm ở localStorage nên việc chọn hướng phải chạy trên trình duyệt.
 */

import {useRouter} from "next/navigation";
import {useEffect} from "react";

import {getToken} from "@/lib/api";

export default function RootPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace(getToken() ? "/dashboard" : "/login");
  }, [router]);
  return (
    <main className="page">
      <p className="muted">Đang chuyển hướng…</p>
    </main>
  );
}
