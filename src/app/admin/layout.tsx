import type { ReactNode } from "react";

import "../admin.css";

/**
 * Layout terluar untuk semua route `/admin`.
 *
 * Hanya memuat `admin.css`. Penjaga sesi dan kerangka panel diletakkan di
 * route group `(panel)` supaya `/admin/login` tetap bisa diakses saat belum
 * masuk.
 */
export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return <div className="admin">{children}</div>;
}
