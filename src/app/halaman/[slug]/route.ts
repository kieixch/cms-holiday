import { NextResponse, type NextRequest } from "next/server";

import { injectBackHomeButton } from "@/lib/halaman-back-button";
import { prisma } from "@/lib/db";

/**
 * Dokumen HTML mandiri dari panel admin (`/admin/halaman`).
 *
 * Route handler, bukan `page.tsx`: isi kolom `html` dikirim apa adanya lewat
 * response body — tanpa layout, tanpa metadata React, tanpa komponen apa pun
 * — persis permintaan "dokumen HTML utuh tampil sebagai halaman web".
 *
 * Satu pengecualian: tombol "kembali ke beranda" disuntikkan sebelum
 * `</body>`. Dokumen ini tidak punya navigasi situs, jadi tanpa tombol itu
 * pengunjung yang tiba dari tautan luar terkunci di halaman.
 *
 * Route handler Next tidak di-cache secara default (lihat docs Route
 * Handlers), dan `Cache-Control: no-store` dipasang eksplisit supaya simpanan
 * admin langsung terlihat tanpa menunggu.
 */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  // Hanya scope `page`. Baris `sosmed` (link-bio) punya kolom `html` legacy
  // yang tidak boleh ikut disajikan lewat route ini — di sini CSP-nya longgar
  // (boleh script inline), sedangkan konten bio memang dirender React di
  // `/bio/[slug]` yang menyaring scope-nya sendiri.
  const page = await prisma.htmlPage.findUnique({ where: { slug, scope: "page" } });

  if (!page || !page.isPublished) {
    return new NextResponse(NOT_FOUND_HTML, {
      status: 404,
      headers: HTML_HEADERS,
    });
  }

  return new NextResponse(injectBackHomeButton(page.html), { headers: HTML_HEADERS });
}

const HTML_HEADERS: Record<string, string> = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store",
};

const NOT_FOUND_HTML = `<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Halaman tidak ditemukan</title>
  </head>
  <body style="margin:0;display:grid;place-items:center;min-height:100vh;font-family:system-ui,sans-serif;background:#fafaf7;color:#163c32">
    <div style="text-align:center;padding:24px">
      <p style="margin:0;font-size:48px;font-weight:700">404</p>
      <p style="margin:8px 0 20px">Halaman tidak ditemukan.</p>
      <a href="/" style="color:#245447">&#8592; Kembali ke beranda</a>
    </div>
  </body>
</html>
`;
