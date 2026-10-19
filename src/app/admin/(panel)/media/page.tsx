import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth";

/**
 * Alias lama dari halaman galeri.
 *
 * Section "Media" dulu hidup di `/admin/media` dan masih bisa muncul di
 * bookmark atau tautan lama. Halaman ini hanya meneruskan, jadi satu-satunya
 * tempat yang perlu diperbarui ke depan adalah `/admin/gallery`.
 *
 * Guard sesi dipasang eksplisit di sini (bukan cuma mengandalkan layout
 * parent) supaya redirect ini tetap tertutup walau suatu saat route group
 * dipindah.
 */
export default async function LegacyMediaPage() {
  await requireAdmin();
  redirect("/admin/gallery");
}