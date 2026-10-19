import type { ReactNode } from "react";

import { ContentRefresh } from "@/components/site/content-refresh";

/**
 * Layout grup route publik.
 *
 * Sengaja tidak merender kerangka apa pun selain `children`: semua halaman
 * publik memakai root `.hb2d1n` dengan modifier sendiri, sedangkan header/footer
 * juga berada DI DALAM wrapper itu (selector CSS-nya `.hb2d1n .site-footer`).
 * Jadi kerakasnya dirakit per halaman lewat `PublicShell`.
 *
 * `ContentRefresh` hanya menempelkan pemantau versi konten (tanpa markup) agar
 * tab yang sudah terbuka ikut memperbarui diri setelah admin menyimpan.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <ContentRefresh />
    </>
  );
}
