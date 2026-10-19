/**
 * UI "loading" untuk route publik & seluruh aplikasi.
 *
 * - `PageSkeleton` : kerangka yang meniru halaman publik (navbar tipis, blok
 *   hero, judul seksi, dan grid kartu paket). Muncul saat navigasi antar
 *   halaman publik sehingga pengunjung melihat halaman "mengisi" tanpa teks
 *   kosong atau lompatan tata letak.
 * - `PageSpinner`  : spinner tengah untuk navigasi halaman (mis. panel admin),
 *   tempat tidak ada kerangka khusus.
 *
 * Komponen ini murni markup statis tanpa interaksi — dipakai file khusus
 * `loading.tsx` App Router yang otomatis membungkus page dalam Suspense.
 */
import type { ReactNode } from "react";

/** Jumlah kartu paket tiruan yang dirender di skeleton. */
const SKELETON_CARDS = 3;

/** Satu kartu paket tiruan (bayangan `.package-card`). */
function CardSkeleton() {
  return (
    <div className="hb-skeleton-card" aria-hidden="true">
      <div className="hb-skeleton hb-skeleton-card-visual" />
      <div className="hb-skeleton-card-body">
        <span className="hb-skeleton hb-skeleton--tag" />
        <div className="hb-skeleton hb-skeleton--title" />
        <div className="hb-skeleton hb-skeleton--line" />
        <div className="hb-skeleton hb-skeleton--line short" />
        <div className="hb-skeleton hb-skeleton--price" />
        <div className="hb-skeleton hb-skeleton--btn" />
      </div>
    </div>
  );
}

/**
 * Kerangka halaman publik: navbar tipis + hero + judul seksi + grid kartu.
 * `cards` dibatasi 1..6 supaya tidak melebihi grid asli (maks 3 kolom).
 */
export function PageSkeleton({ cards = SKELETON_CARDS }: { cards?: number }) {
  const count = Math.max(1, Math.min(6, cards));
  return (
    <div className="hb-loading" role="status" aria-label="Memuat halaman">
      <div className="hb-loading-navbar" aria-hidden="true">
        <div className="hb-skeleton hb-loading-logo-chip" />
      </div>
      <div className="hb-loading-inner">
        <div className="hb-skeleton hb-skeleton--hero" aria-hidden="true" />
        <div className="hb-skeleton-head" aria-hidden="true">
          <span className="hb-skeleton hb-skeleton--tag" />
          <div className="hb-skeleton hb-skeleton--title" />
        </div>
        <div className="hb-skeleton-grid">
          {Array.from({ length: count }, (_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Spinner tengah untuk halaman tanpa kerangka khusus. */
export function PageSpinner({ label = "Memuat…" }: { label?: string; children?: ReactNode }) {
  return (
    <div className="hb-page-loader" role="status" aria-label={label}>
      <span className="hb-spinner" aria-hidden="true" />
      <p className="hb-page-loader-text">{label}</p>
    </div>
  );
}