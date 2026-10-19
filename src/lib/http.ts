import { NextResponse } from "next/server";

/**
 * Tolak permintaan lintas situs pada route handler (`POST`).
 *
 * Server Action sudah dilindungi pemeriksaan Origin bawaan Next, tetapi route
 * handler tidak. Cookie sesi memakai `SameSite=Lax` sehingga browser modern
 * memang tidak mengirimnya pada permintaan lintas situs, tapi ini lapisan
 * tambahan: kalau `SameSite` pernah dilonggarkan, proteksi tetap ada.
 *
 * Mengembalikan respons 403 bila ditolak, atau `null` bila aman.
 */
export function assertSameOrigin(request: Request): NextResponse | null {
  const origin = request.headers.get("origin");
  // Tanpa Origin (mis. curl/script internal) tidak ada yang bisa disamarkan.
  if (!origin) return null;

  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = (forwardedHost ? forwardedHost.split(",")[0].trim() : request.headers.get("host")) ?? "";
  if (!host) return null;

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return NextResponse.json({ error: "Origin tidak valid." }, { status: 403 });
  }

  if (originHost !== host) {
    return NextResponse.json({ error: "Permintaan lintas situs ditolak." }, { status: 403 });
  }
  return null;
}