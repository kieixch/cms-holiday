import "server-only";

import { prisma } from "@/lib/db";

/**
 * Versi konten global situs.
 *
 * Dinaikkan setiap ada penyimpanan dari panel admin, lalu dibaca halaman
 * publik (lewat `/api/content-version`) untuk memutuskan perlu auto-refresh
 * atau tidak. Disimpan di `SiteSettings`; kalau barisnya belum ada (DB baru
 * sebelum seed), dianggap versi 0.
 */

export async function bumpContentVersion(): Promise<void> {
  try {
    await prisma.siteSettings.updateMany({
      data: { contentVersion: { increment: 1 } },
    });
  } catch (error) {
    // Perubahan konten tetap dianggap sukses walau penanda versi gagal: admin
    // cuma kehilangan auto-refresh, bukan datanya.
    console.error("[content-version] gagal menaikkan versi:", error);
  }
}

export async function getContentVersion(): Promise<number> {
  const row = await prisma.siteSettings.findFirst({
    select: { contentVersion: true },
  });
  return row?.contentVersion ?? 0;
}