"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { findImageUsage } from "@/lib/admin/gallery-usage";
import { requireAdmin } from "@/lib/auth";
import { bumpContentVersion } from "@/lib/content-version";
import { prisma } from "@/lib/db";
import { managedKeyFromUrl } from "@/lib/image";
import { getStorage } from "@/lib/storage";

export type GalleryState = { error?: string; ok?: string };

const id = z.string().min(1);

/** Prisma melempar P2025 kalau baris yang di-update/hapus tidak ada. */
function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2025"
  );
}

/** Halaman yang harus disegarkan setelah galeri berubah. */
async function revalidatePublic() {
  revalidatePath("/");
  revalidatePath("/admin/gallery");
  await bumpContentVersion();
}



export async function updateAssetAltAction(
  _prev: GalleryState,
  formData: FormData,
): Promise<GalleryState> {
  await requireAdmin();

  const parsed = id.safeParse(formData.get("id"));
  if (!parsed.success) return { error: "ID gambar tidak valid." };

  const alt = String(formData.get("alt") ?? "").slice(0, 300);

  try {
    await prisma.mediaAsset.update({
      where: { id: parsed.data },
      data: { alt },
    });
  } catch (error) {
    if (isNotFound(error)) return { error: "Gambar sudah tidak ada." };
    throw error;
  }

  await revalidatePublic();
  return { ok: "Teks alternatif disimpan." };
}

/**
 * Simpan alt teks dan folder dari halaman detail satu aset.
 *
 * `alt` dan `folder` ikut disalin ke hasil suntingan lewat body crop, jadi
 * perubahan di sini terbawa saat admin memotong gambar yang sama.
 *
 * Native form + redirect, bukan `useActionState`: input-nya tidak perlu
 * controlled state, jadi form tetap berfungsi tanpa JavaScript dan HTML-nya
 * bisa diuji dari luar proses.
 */
export async function updateAssetMetaAction(formData: FormData): Promise<void> {
  // Auth duluan — jangan sampai input apa pun diproses sebelum cek sesi.
  await requireAdmin();

  const parsed = id.safeParse(formData.get("id"));
  if (!parsed.success) redirect("/admin/gallery?galat=ID%20gambar%20tidak%20valid.");

  const alt = String(formData.get("alt") ?? "").slice(0, 300);
  const folder = String(formData.get("folder") ?? "")
    .trim()
    .slice(0, 80);

  await prisma.mediaAsset
    .update({
      where: { id: parsed.data },
      data: { alt, folder: folder || "uploads" },
    })
    .catch((error) => {
      if (isNotFound(error)) {
        redirect("/admin/gallery?galat=Gambar%20sudah%20tidak%20ada.");
      }
      throw error;
    });

  await revalidatePublic();
  revalidatePath(`/admin/gallery/${parsed.data}`);
  redirect(`/admin/gallery/${parsed.data}?tersimpan=meta`);
}

/**
 * Ubah nama file tampilan.
 *
 * Nama file dipakai sebagai label di grid dan picker, jadi ini murni kosmetik:
 * URL dan objek di storage tidak berubah, sehingga tidak ada yang bisa rusak
 * karena salah ketik.
 */
export async function renameAssetAction(formData: FormData): Promise<void> {
  // Auth duluan — jangan sampai input apa pun diproses sebelum cek sesi.
  await requireAdmin();

  const parsed = id.safeParse(formData.get("id"));
  if (!parsed.success) redirect("/admin/gallery?galat=ID%20gambar%20tidak%20valid.");

  const filename = String(formData.get("filename") ?? "").trim().slice(0, 160);
  if (!filename) {
    redirect(`/admin/gallery/${parsed.data}?galat=Nama%20file%20tidak%20boleh%20kosong.`);
  }

  await prisma.mediaAsset
    .update({
      where: { id: parsed.data },
      data: { filename },
    })
    .catch((error) => {
      if (isNotFound(error)) {
        redirect("/admin/gallery?galat=Gambar%20sudah%20tidak%20ada.");
      }
      throw error;
    });

  await revalidatePublic();
  revalidatePath(`/admin/gallery/${parsed.data}`);
  redirect(`/admin/gallery/${parsed.data}?tersimpan=nama`);
}

/**
 * Hapus aset galeri.
 *
 * Urutannya dibalik dari biasanya: cek pakai → hapus baris DB → hapus objek.
 * Kalau objek gagal dihapus, file yatimnya tidak berbahaya (tak terpakai lagi),
 * sedangkan kalau DB dihapus dulu lalu proses mati, kita kehilangan jejaknya.
 */
export async function deleteAssetAction(
  _prev: GalleryState,
  formData: FormData,
): Promise<GalleryState> {
  await requireAdmin();

  const parsed = id.safeParse(formData.get("id"));
  if (!parsed.success) return { error: "ID gambar tidak valid." };

  const asset = await prisma.mediaAsset.findUnique({
    where: { id: parsed.data },
    include: { _count: { select: { derivations: true } } },
  });
  if (!asset) return { error: "Gambar sudah tidak ada." };

  // Aset yang punya turunannya dipakai sebagai asal-usul. Hapusinya berarti
  // hasil suntingan kehilangan jejaknya, jadi turunannya dibersihkan dulu.
  if (asset._count.derivations > 0) {
    return {
      error:
        `Gambar ini jadi asal-usul ${asset._count.derivations} hasil suntingan. ` +
        `Hapus hasil suntingannya dulu supaya jejaknya tidak putus.`,
    };
  }

  const usage = await findImageUsage(asset.url);
  if (usage.count > 0) {
    return {
      error:
        `Gambar ini masih dipakai di ${usage.count} tempat, jadi tidak dihapus: ` +
        usage.places.map((p) => p.where).join(", ") +
        `. Lepas dulu dari sana, baru hapus di sini.`,
    };
  }

  await prisma.mediaAsset.delete({ where: { id: asset.id } });

  // Hanya file milik kita sendiri yang dihapus. URL hasil impor lama masih
  // menunjuk ke host WordPress dan tidak boleh disentuh.
  const key = managedKeyFromUrl(asset.url);
  if (key) {
    try {
      await getStorage().remove(key);
    } catch {
      // Objek sudah tidak ada di bucket, atau bucket sedang tidak bisa dijangkau.
      // Baris DB tetap hilang supaya tidak muncul lagi di daftar.
    }
  }

  await revalidatePublic();
  return { ok: "Gambar dihapus." };
}

/**
 * Wrapper untuk `<form action={...}>` di grid galeri.
 *
 * Pesan kegagalan dibawa lewat query param, bukan redirect biasa. Kalau hapus
 * ditolak dan kita tetap `redirect()` tanpa penerusan pesan, admin melihat
 * daftar galeri yang berubah tidak jelas dan tidak pernah tahu alasannya —
 * termasuk kasus aset yang masih jadi asal-usul hasil suntingan.
 */
export async function deleteAssetAndRedirectAction(formData: FormData): Promise<void> {
  const result = await deleteAssetAction({}, formData);
  if (result.error) {
    redirect(`/admin/gallery?galat=${encodeURIComponent(result.error)}`);
  }
  if (result.ok) {
    redirect(`/admin/gallery?ok=${encodeURIComponent(result.ok)}`);
  }
  redirect("/admin/gallery");
}
