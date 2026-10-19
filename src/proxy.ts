import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "./lib/session-constants";

/**
 * Gerbang awal untuk panel admin (konvensi Next 16: `proxy.ts`, pengganti
 * `middleware.ts` yang sudah deprecated).
 *
 * Pemeriksaan di sini SENGAJA hanya **keberadaan cookie** — proxy berjalan di
 * runtime edge sebelum route di-render, tidak boleh menarik modul bersama
 * (lihat docs: "should not attempt relying on shared modules or globals"),
 * dan Prisma tidak tersedia di edge. Verifikasi JWT + cek database + role
 * tetap dilakukan penuh oleh `getSessionUser()` / `requireAdmin()` di tiap
 * halaman, server action, dan route handler.
 *
 * Peran di sini murni defense-in-depth: menutup celah "route baru di bawah
 * `/admin` yang lupa dipasangi guard" dan memastikan POST server action tanpa
 * sesi langsung ditolak sebelum masuk router.
 *
 * `/admin/login` harus lolos tanpa cookie, kalau tidak terjadi redirect loop.
 */
export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // Halaman login memang untuk pengunjung tanpa sesi (dan di situ sendiri
  // ada `redirectIfSignedIn` untuk yang sudah masuk).
  if (pathname === "/admin/login") return NextResponse.next();

  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  // API admin menjawab JSON 401, bukan redirect halaman HTML — klien fetch
  // (`gallery-uploader`, `asset-editor`) tidak bisa mengikuti redirect login.
  if (pathname.startsWith("/api/")) {
    if (hasSession) return NextResponse.next();
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (hasSession) return NextResponse.next();
  return NextResponse.redirect(new URL("/admin/login", request.url));
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
