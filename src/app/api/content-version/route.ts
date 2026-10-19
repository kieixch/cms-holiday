import { NextResponse } from "next/server";

import { getContentVersion } from "@/lib/content-version";

export const dynamic = "force-dynamic";

/**
 * Versi konten global dipakai halaman publik untuk mendeteksi perubahan dari
 * panel admin. `no-store` supaya CDN/proxy tidak pernah menyajikan angka basi.
 */
export async function GET() {
  const version = await getContentVersion();
  return NextResponse.json(
    { version },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}