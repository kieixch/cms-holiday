/**
 * Bentuk nilai form yang dikirim ke `<AdminForm>`.
 *
 * Modular: modul ini tidak mengimpor Prisma maupun React, jadi bisa dipakai
 * di server (untuk menyusun `initial`) maupun di client.
 */

type Omitted<T, K extends keyof T> = Omit<T, K>;

/**
 * Salinan objek tanpa sejumlah kunci.
 *
 * Dipakai untuk membuang kolom yang bukan milik form — `id`, `createdAt`,
 * `updatedAt`, `slug` turunan, atau relasi yang ditangani terpisah di action.
 *
 * Alternatifnya `const { id, ...rest } = record`, tapi itu menyisakan variabel
 * yang tidak terpakai dan memicu peringatan lint di setiap halaman. Versi ini
 * hanya menyebut kunci yang dibuang, dan kelewatan kolom baru di schema akan
 * otomatis ikut terbawa ke form.
 */
export function omit<T extends object, K extends keyof T>(
  source: T,
  keys: readonly K[],
): Omitted<T, K> {
  const copy = { ...source } as Record<string, unknown>;
  for (const key of keys) delete copy[key as string];
  return copy as Omitted<T, K>;
}
