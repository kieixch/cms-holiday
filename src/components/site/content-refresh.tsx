"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Jaga halaman publik tetap sinkron dengan panel admin.
 *
 * Halaman publik di-cache (ISR), jadi tab yang sudah terbuka tidak tahu kalau
 * admin baru menyimpan perubahan. Komponen ini mengambil versi konten global
 * secara berkala dari `/api/content-version`; begitu angkanya berubah,
 * `router.refresh()` menarik ulang data server tanpa reload manual.
 *
 * Versi pertama dijadikan patokan (tidak memicu refresh) supaya tidak terjadi
 * loop saat halaman dimuat dari cache.
 */
const POLL_INTERVAL_MS = 15_000;

export function ContentRefresh() {
  const router = useRouter();
  const baselineRef = useRef<number | null>(null);

  useEffect(() => {
    async function poll() {
      try {
        const response = await fetch("/api/content-version", { cache: "no-store" });
        if (!response.ok) return;
        const { version } = (await response.json()) as { version: number };

        if (baselineRef.current === null) {
          baselineRef.current = version;
        } else if (version !== baselineRef.current) {
          baselineRef.current = version;
          router.refresh();
        }
      } catch {
        // Abaikan gangguan jaringan: percobaan berikutnya akan menyusul.
      }
    }

    function tick() {
      if (document.visibilityState === "visible") void poll();
    }

    void poll();
    const timer = window.setInterval(tick, POLL_INTERVAL_MS);
    // Saat tab kembali aktif, jangan tunggu interval penuh dulu.
    document.addEventListener("visibilitychange", tick);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router]);

  return null;
}