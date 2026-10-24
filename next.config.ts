import type { NextConfig } from "next";

/**
 * Host yang boleh dipakai `next/image` sebagai sumber gambar.
 *
 * `S3_PUBLIC_URL` bisa berupa domain bucket R2 (`<bucket>.r2.dev`) atau custom
 * domain. Yang di-pattern-kan hanya hostname-nya supaya path wildcard tetap
 * aman — semuanya harus `/2026/...`, bukan mengizinkan seluruh origin.
 */
const storageHost = (() => {
  const raw = process.env.S3_PUBLIC_URL;
  if (!raw) return null;
  try {
    return new URL(raw.includes("://") ? raw : `https://${raw}`).hostname;
  } catch {
    return null;
  }
})();

const remotePatterns: NonNullable<NextConfig["images"]>["remotePatterns"] = [
  // Sumber gambar legacy WordPress, dipakai selama masa transisi seed.
  // Hapus setelah semua media dipindahkan ke storage sendiri.
  { protocol: "https", hostname: "holidaybanyuwangi.com", pathname: "/wp-content/uploads/**" },
  // Bucket R2 publik. `r2.dev` bisa berubah saat bucket dibuat ulang, jadi
  // seluruh subdomain diizinkan; tetap dibatasi ke HTTPS dan path apa pun.
  { protocol: "https", hostname: "**.r2.dev", pathname: "/**" },
];

if (storageHost) {
  remotePatterns.push({ protocol: "https", hostname: storageHost, pathname: "/**" });
}

const isDev = process.env.NODE_ENV !== "production";

/**
 * CSP konservatif.
 *
 * Next menyisipkan skrip inline untuk hidrasi, dan proyek ini memakai CSS
 * inline pada beberapa blok, jadi `'unsafe-inline'` masih dibutuhkan. Meski
 * begitu directive ini tetap menutup vektor utama: `frame-ancestors`/`object-src`
 * mencegah clickjacking dan plugin, `base-uri`/`form-action` membatasi eksfiltrasi.
 * `'unsafe-eval'` hanya di dev (React refresh membutuhkannya).
 */
const cspDirectives = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://www.googletagmanager.com https://*.googletagmanager.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://www.google.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.googletagmanager.com https://*.google-analytics.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://www.google.com https://www.google.co.id https://*.doubleclick.net",
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "frame-src 'self' https://www.googletagmanager.com https://td.doubleclick.net https://www.google.com",
];

const csp = cspDirectives.join("; ");

/**
 * CSP panel admin: sama ketatnya dengan situs publik, ditambah `frame-src`
 * yang mengizinkan `data:`.
 *
 * Satu-satunya alasan: editor `/adm-cms-hb/halaman` me-render draf dokumen di
 * iframe `data:text/html` (lihat `HalamanDocPreview`). Dokumen `data:`
 * berdiri sendiri tanpa CSP — kalau memakai `srcdoc`, dokumennya mewarisi
 * CSP admin dan stylesheet/font eksternal yang ditempel admin ikut
 * diblokir, sehingga pratinjau tidak jujur. `frame-src` hanya melonggarkan
 * SIAPA yang boleh diframe, bukan apa yang boleh dilakukan halaman admin;
 * `default-src`/`script-src`/dst. tetap utuh.
 */
const adminCsp = [...cspDirectives.filter((d) => !d.startsWith("frame-src")), "frame-src 'self' data:"].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  // HSTS hanya di produksi; di dev (http) justru merusak localhost.
  ...(isDev
    ? []
    : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
];

/**
 * CSP longgar khusus dokumen HTML admin di `/halaman/*`.
 *
 * Dokumen di route ini ditempel apa adanya oleh admin (konten tepercaya) dan
 * dirender di luar layout situs, jadi sumber eksternal — font, stylesheet,
 * skrip, iframe video — harus boleh dimuat; dengan CSP situs yang ketat,
 * halaman hasil tempel akan dirender setengah mati. Keamanan inti tetap
 * dipertahankan: `frame-ancestors`/`X-Frame-Options` mencegah clickjacking,
 * `base-uri 'self'` mencegah pembajakan tag `<base>`, `object-src 'none'`
 * menutup plugin. Hanya halaman `/halaman/*` yang kena; semua rute lain
 * memakai CSP ketat di `securityHeaders`.
 */
const halamanCsp = [
  "default-src 'self' https: data: blob:",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https: blob:`,
  "style-src 'self' 'unsafe-inline' https: blob:",
  "font-src 'self' data: https:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https:",
  "frame-ancestors 'none'",
].join("; ");

const halamanHeaders = [
  { key: "Content-Security-Policy", value: halamanCsp },
  ...securityHeaders.filter((h) => h.key !== "Content-Security-Policy"),
];

const adminHeaders = [
  { key: "Content-Security-Policy", value: adminCsp },
  ...securityHeaders.filter((h) => h.key !== "Content-Security-Policy"),
];

const nextConfig: NextConfig = {
  /**
   * Hostname storage publik ikut dikirim ke client supaya `isOptimizableImage`
   * (src/lib/media.ts) mengenali custom domain R2, bukan hanya `*.r2.dev`.
   */
  env: {
    NEXT_PUBLIC_MEDIA_HOST: storageHost ?? "",
  },
  async headers() {
    // Entry spesifik diletakkan setelah entry umum: ketika beberapa entry
    // cocok untuk satu path, nilai header dari entry BELAKANGAN yang menang —
    // sudah diverifikasi empiris lewat `curl -I /halaman/<slug>` (CSP longgar
    // menang tanpa duplikat) dan `curl -I /adm-cms-hb/halaman/baru`.
    return [
      { source: "/(.*)", headers: securityHeaders },
      { source: "/halaman/:path*", headers: halamanHeaders },
      { source: "/bio/:path*", headers: halamanHeaders },
      { source: "/adm-cms-hb/:path*", headers: adminHeaders },
    ];
  },
  images: {
    remotePatterns,
    qualities: [70, 75, 82, 90],
    formats: ["image/avif", "image/webp"],
  },
  serverExternalPackages: ["sharp", "@prisma/adapter-pg", "pg"],

  /**
   * Batas buffer body untuk request yang melewati `proxy.ts` (matcher
   * mencakup `/api/admin/*` dan `/adm-cms-hb/*`). Default Next hanya 10MB:
   * body di atasnya TIDAK ditolak, melainkan dipotong diam-diam (hanya
   * console.warn), sehingga `request.formData()` membaca multipart yang
   * terpotong dan gagal parse — upload multi-file >10MB selalu error 400
   * "Permintaan tidak bisa dibaca". Nilai ini harus >= total maksimum
   * upload galeri (lihat `MAX_TOTAL_UPLOAD_BYTES` di
   * `src/app/api/admin/gallery/route.ts`, disamakan menjadi 100MB).
   *
   * Catatan: buffering terjadi SEBELUM auth check di route, jadi angka
   * besar sedikit memperbesar permukaan DoS memori lewat request tanpa
   * sesi. Dibatasi 100MB sebagai kompromi; batas per-file (25MB, env
   * MEDIA_MAX_BYTES) tidak diubah.
   */
  experimental: {
    proxyClientMaxBodySize: "100mb",
  },

  /**
   * `/uploads/[...key]` membaca path dinamis dari disk. Turbopack akan
   * memperingatkan bahwa "dynamic filesystem access causes tracing of the whole
   * project". Peringatan itu tidak bisa dihilangkan — aksesnya memang dinamis,
   * dan tidak berbahaya karena route ini hanya aktif di dev/VPS.
   *
   * `outputFileTracingExcludes` tetap dipasang supaya folder media tidak ikut
   * masuk ke trace. Ini mengecilkan output build, bukan menghilangkan warning.
   */
  outputFileTracingExcludes: {
    "/uploads/*": ["./storage/**/*", "./public/uploads/**/*"],
  },
};

export default nextConfig;