import type { ReactNode } from "react";

import { requireAdmin } from "@/lib/auth";

import { AdminSidebar } from "./admin-sidebar";
import { AdminNavProgress } from "./nav-progress";

/**
 * Kerangka panel admin: sidebar + konten.
 *
 * Route group `(panel)` tidak menambah segmen URL, tapi memungkinkan pemisahan
 * layout ini dari `/admin/login` yang tidak boleh terjaga sesi.
 *
 * Sidebar dipindah ke komponen client (`AdminSidebar`) supaya bisa bergeser
 * masuk-keluar di layar sempit lewat tombol hamburger; layout-nya sendiri tetap
 * server component supaya penjagaan sesi tetap di server.
 */
export default async function AdminPanelLayout({ children }: { children: ReactNode }) {
  const user = await requireAdmin();

  return (
    <div className="admin-shell">
      <AdminSidebar user={{ name: user.name, email: user.email }} />

      <main className="admin-main">
        {/*
          Spinner saat pindah halaman antar-panel. Hanya menutupi panel kanan
          (overlay `absolute` terhadap `.admin-main`), dan dimatikan lewat
          perubahan `usePathname()` karena layout ini tidak ter-unmount.
          Client-only, jadi tidak membungkus page dalam Suspense dan tidak
          mengubah status HTTP — `redirect()` alias `/admin/media` tetap 307
          dan `notFound()` tetap 404.
        */}
        <AdminNavProgress />
        {children}
      </main>
    </div>
  );
}