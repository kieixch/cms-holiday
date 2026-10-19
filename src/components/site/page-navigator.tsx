"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { PageSkeleton } from "./loading";

/** Bandingkan path tanpa peduli slash akhir (`/a/` dianggap sama dengan `/a`). */
function samePath(a: string, b: string): boolean {
  const norm = (value: string) => (value.length > 1 ? value.replace(/\/+$/, "") : value);
  return norm(a) === norm(b);
}

/**
 * Overlay navigasi publik.
 *
 * Semua tautan internal (menu, kartu paket, logo) bernavigasi lewat router
 * client-side, jadi saat halaman berikutnya sedang disiapkan kita tampilkan
 * kerangka paket (`PageSkeleton`) menutupi layar. Overlay ini murni client dan
 * tidak pernah masuk markup statis — jadi tidak mengganggu SEO maupun audit
 * (berbeda dengan `loading.tsx` yang me-streaming kerangka ke dalam HTML).
 *
 * Komponen ini dipasang di dalam `PublicShell`. Berpindah antar halaman pada
 * rute yang sama (mis. `/paket-a` → `/paket-b`, atau `/kategori-a` →
 * `/kategori-b`) TIDAK memunculkan `PublicShell` baru — React memakai ulang
 * komponennya — jadi overlay tidak bisa mengandalkan unmount saja. Karena itu
 * overlay disimpan bersama path asal navigasi: begitu `usePathname()` berubah,
 * overlay otomatis dianggap selesai. Klik ke halaman yang sedang dibuka (mis.
 * logo saat sudah di beranda) juga tidak dianggap pindah, karena tidak memicu
 * navigasi apa-apa.
 *
 * Panel admin TIDAK memakai ini karena layout-nya memang tidak pernah
 * ter-unmount; admin memakai `AdminNavProgress`.
 */
export function PageNavigator() {
  const pathname = usePathname();
  // Path tempat navigasi dimulai; `null` kalau tidak sedang pindah.
  const [from, setFrom] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const guard = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Overlay hanya tampil selama path masih sama dengan asal navigasi. Derivasinya
  // murni (tanpa setState di effect) supaya tidak ada render berantai.
  const going = from !== null && samePath(from, pathname);

  // Setelah path benar-benar berubah, lupakan `from` supaya kunjungan berikutnya
  // ke path lama tidak ikut menyalakan overlay. Menyesuaikan state saat render
  // memang pola yang diizinkan React untuk derivasi dari nilai sebelumnya.
  const [seen, setSeen] = useState(pathname);
  if (seen !== pathname) {
    setSeen(pathname);
    if (from !== null) setFrom(null);
  }

  const clear = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    if (guard.current !== null) clearTimeout(guard.current);
    timer.current = null;
    guard.current = null;
  };

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      // Abaikan klik dengan modififier (buka tab baru, dst.) dan target _blank.
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (event.button !== 0) return;

      const anchor = (event.target as HTMLElement | null)?.closest?.("a");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target === "_blank") return;

      // Panel admin juga merender `PublicShell` di live preview, jadi klik di
      // sana tidak boleh memunculkan overlay publik di atas admin.
      if (anchor.closest(".admin-main")) return;

      const href = anchor.getAttribute("href") ?? "";
      // Hanya tautan relatif internal ("/slug/"); jangan tautan protokol
      // ("https://…", "//…") atau jangkar dalam halaman ("#…").
      if (!href.startsWith("/") || href.startsWith("//") || href.startsWith("#")) return;

      // Klik ke halaman yang sedang dibuka tidak memicu navigasi, jadi jangan
      // tampilkan kerangka — inilah yang dulu bikin overlay nyangkut di logo.
      let target = href.split(/[?#]/, 1)[0] ?? "";
      try {
        target = new URL(href, window.location.href).pathname;
      } catch {
        /* pakai href apa adanya */
      }
      if (samePath(target, pathname)) return;

      const origin = pathname;
      clear();
      timer.current = setTimeout(() => {
        setFrom(origin);
        // Jaring terakhir: kalau navigasi tidak pernah selesai (mis. gagal
        // prefetch di koneksi buruk), overlay tetap hilang sendiri.
        guard.current = setTimeout(() => setFrom(null), 10000);
      }, 150);
    };

    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      clear();
    };
  }, [pathname]);

  if (!going) return null;

  return (
    <div className="hb-nav-overlay" role="presentation" aria-hidden="true">
      <PageSkeleton />
    </div>
  );
}