import type { Metadata } from "next";
import "./globals.css";
import "./admin.css";

export const metadata: Metadata = {
  title: {default: "AgriLog — Quản trị", template: "%s · AgriLog Quản trị"},
  description:
    "Trang quản trị AgriLog v2: lô đất, danh mục giống cây, giá phân bón, kho vật tư và thu chi của các nông hộ.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
