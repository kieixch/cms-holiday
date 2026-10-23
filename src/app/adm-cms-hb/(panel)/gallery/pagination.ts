/** Jumlah baris grid per halaman. */
export const ROWS_PER_PAGE = 3;

/**
 * Tebakan awal untuk desktop 4 kolom (4 × 3 baris). Jumlah kolom sebenarnya
 * ditentukan CSS `auto-fill`, jadi `GalleryGrid` mengukur sendiri lalu
 * mengganti `?per=` lewat `router.replace` bila tebakan ini meleset.
 */
export const DEFAULT_PER = 12;

export const MIN_PER = 3;
export const MAX_PER = 60;

export function clampPer(value: number): number {
  return Math.min(MAX_PER, Math.max(MIN_PER, value));
}

/** Jumlah nomor halaman yang terlihat; sisanya diringkas jadi "…". */
export const VISIBLE_PAGES = 3;

/**
 * Deret nomor halaman: maksimal 3 nomor di sekitar halaman aktif, dengan "…"
 * di sisi yang masih menyisakan halaman lain. Nomor di luar jendela tetap bisa
 * dituju lewat input "Ke halaman".
 */
export function pageWindow(current: number, total: number): (number | "gap")[] {
  if (total <= VISIBLE_PAGES) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  let start = Math.max(1, current - 1);
  const end = Math.min(total, start + VISIBLE_PAGES - 1);
  start = Math.max(1, end - VISIBLE_PAGES + 1);

  const items: (number | "gap")[] = [];
  if (start > 1) items.push("gap");
  for (let p = start; p <= end; p += 1) items.push(p);
  if (end < total) items.push("gap");

  return items;
}
