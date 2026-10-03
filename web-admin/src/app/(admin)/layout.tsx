import {AdminShell} from "@/components/AdminShell";

/** Every signed-in page shares the shell: sidebar, top bar, session. */
export default function AdminLayout({children}: {children: React.ReactNode}) {
  return <AdminShell>{children}</AdminShell>;
}
