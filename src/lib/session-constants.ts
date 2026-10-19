/**
 * Nama cookie sesi admin — dipakai `lib/auth.ts` (baca/tulis) dan
 * `src/proxy.ts` (pemeriksaan awal sebelum render).
 *
 * Sengaja dipisah ke modul ini tanpa `server-only`: `proxy.ts` berjalan di
 * runtime edge dan tidak boleh menarik modul yang memakai Prisma/Node APIs.
 */
export const SESSION_COOKIE = "hb_admin_session";
