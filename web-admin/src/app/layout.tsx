import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgriLog v2 — Quản trị",
  description:
    "Trang quản trị AgriLog v2: theo dõi lô đất, chẩn đoán bệnh cà chua, giá phân bón, kho vật tư và thu chi của các nông hộ.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
