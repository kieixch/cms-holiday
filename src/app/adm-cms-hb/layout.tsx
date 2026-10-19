import type { Metadata } from "next";
import type { ReactNode } from "react";

import "../admin.css";

export const metadata: Metadata = {
  robots: { index: false, follow: false, noarchive: true },
  title: { default: "Admin • Holiday Banyuwangi", template: "%s • Admin" },
};

/**
 * Layout terluar untuk semua route `/adm-cms-hb`.
 *
 * Hanya memuat `admin.css`. Penjaga sesi dan kerangka panel diletakkan di
 * route group `(panel)` supaya `/adm-cms-hb/login` tetap bisa diakses saat belum
 * masuk.
 */
export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return <div className="admin">{children}</div>;
}

