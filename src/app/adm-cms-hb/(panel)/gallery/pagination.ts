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
