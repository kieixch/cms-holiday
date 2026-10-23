/**
 * Menentukan apakah sebuah URL gambar boleh lewat optimizer Next.
 *
 * Optimizer mengambil gambar dari sisi server Vercel, bukan dari browser
 * pengunjung. Ini penting untuk media di bucket R2: sebagian jaringan
 * (mis. ISP yang memblokir `r2.dev`) tidak bisa membuka URL R2 secara
 * langsung, tetapi server Vercel tetap bisa. URL yang tidak lolos ke
 * optimizer dirender apa adanya (`unoptimized`), termasuk host luar yang
 * tidak terdaftar di `images.remotePatterns`.
 *
 * `NEXT_PUBLIC_MEDIA_HOST` diisi dari hostname `S3_PUBLIC_URL` saat build
 * (lihat `next.config.ts`), jadi custom domain R2 ikut dikenali.
 */
const publicMediaHost = (process.env.NEXT_PUBLIC_MEDIA_HOST ?? "")
  .trim()
  .toLowerCase();

export function isOptimizableImage(src: string | null | undefined): boolean {
  if (!src) return false;

  // Path relatif selalu berasal dari origin sendiri (`/uploads/...`).
  if (src.startsWith("/")) return !src.startsWith("//");

  try {
    const url = new URL(src);
    if (url.protocol !== "https:") return false;

    const host = url.hostname.toLowerCase();
    if (publicMediaHost && host === publicMediaHost) return true;
    return host === "r2.dev" || host.endsWith(".r2.dev");
  } catch {
    return false;
  }
}

/** `true` kalau `next/image` harus melewati optimizer (host luar/tak dikenal). */
export function imageUnoptimized(src: string | null | undefined): boolean {
  return !isOptimizableImage(src);
}
