"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Spinner navigasi antar-halaman panel admin.
 *
 * Berbeda dengan `PageNavigator` publik, komponen ini dipasang di layout
 * `(panel)` yang TIDAK ter-unmount saat pindah halaman. Karena itu "sedang
 * memuat" disimpan sebagai path asal klik (`pendingFrom`), bukan boolean:
 * spinner hanya tampil selama `usePathname()` masih sama dengan path asal,
 * dan otomatis hilang begitu path berubah — tanpa `setState` di dalam effect
 * dan tanpa perlu refresh manual. Timer jaring pengaman memastikan spinner
 * tidak pernah menggantung (mis. kalau navigasi batal).
 *
 * Overlay memakai `position: fixed` dengan `left` = lebar sidebar (lihat
 * admin.css), jadi selalu tampak di tengah area konten walau halaman sedang
 * di-scroll — sidebar sengaja TIDAK ikut tertutup supaya menu tetap terlihat
 * dan bisa diklik selama navigasi. Selama overlay aktif scroll <body> juga
 * dikunci (`overflow: hidden`) supaya konten di belakang tidak bisa
 * digerakkan sampai navigasi selesai.
 */
export function AdminNavProgress() {
  const pathname = usePathname();
  const [pendingFrom, setPendingFrom] = useState<string | null>(null);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = pendingFrom !== null && pendingFrom === pathname;

  // Kunci scroll halaman selama spinner tampil. Nilai awal disimpan dan
  // dikembalikan supaya tidak merusak scroll-lock yang mungkin sudah dipasang
  // komponen lain (mis. modal gambar).
  useEffect(() => {
    if (!active) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [active]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      // Abaikan klik dengan modififier (buka tab baru, dst.) dan klik non-kiri.
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (event.button !== 0) return;

      const anchor = (event.target as HTMLElement | null)?.closest?.("a");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target === "_blank") return;

      // Hanya tautan internal: origin sama dan path bukan jangkar/eksternal.
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return;

      const from = window.location.pathname;
      if (showTimer.current !== null) clearTimeout(showTimer.current);
      if (safetyTimer.current !== null) clearTimeout(safetyTimer.current);
      // Jeda singkat supaya navigasi yang sudah ter-prefetch tidak berkedip.
      showTimer.current = setTimeout(() => {
        setPendingFrom(from);
        // Jaring pengaman: kalau navigasi tidak pernah selesai, jangan
        // menggantung selamanya.
        safetyTimer.current = setTimeout(() => setPendingFrom(null), 8000);
      }, 120);
    }

    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      if (showTimer.current !== null) clearTimeout(showTimer.current);
      if (safetyTimer.current !== null) clearTimeout(safetyTimer.current);
    };
  }, []);

  if (!active) return null;

  return (
    <div className="admin-nav-overlay" role="status" aria-live="polite" aria-label="Memuat halaman">
      <span className="hb-spinner" aria-hidden="true" />
    </div>
  );
}