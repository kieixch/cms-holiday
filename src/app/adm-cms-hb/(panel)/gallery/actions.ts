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
  revalidatePath("/adm-cms-hb/gallery");
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
  if (!parsed.success) redirect("/adm-cms-hb/gallery?galat=ID%20gambar%20tidak%20valid.");

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
        redirect("/adm-cms-hb/gallery?galat=Gambar%20sudah%20tidak%20ada.");
      }
      throw error;
    });

  await revalidatePublic();
  revalidatePath(`/adm-cms-hb/gallery/${parsed.data}`);
  redirect(`/adm-cms-hb/gallery/${parsed.data}?tersimpan=meta`);
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
  if (!parsed.success) redirect("/adm-cms-hb/gallery?galat=ID%20gambar%20tidak%20valid.");

  const filename = String(formData.get("filename") ?? "").trim().slice(0, 160);
  if (!filename) {
    redirect(`/adm-cms-hb/gallery/${parsed.data}?galat=Nama%20file%20tidak%20boleh%20kosong.`);
  }

  await prisma.mediaAsset
    .update({
      where: { id: parsed.data },
      data: { filename },
    })
    .catch((error) => {
      if (isNotFound(error)) {
        redirect("/adm-cms-hb/gallery?galat=Gambar%20sudah%20tidak%20ada.");
      }
      throw error;
    });

  await revalidatePublic();
  revalidatePath(`/adm-cms-hb/gallery/${parsed.data}`);
  redirect(`/adm-cms-hb/gallery/${parsed.data}?tersimpan=nama`);
}

type DeleteOutcome =
  | { ok: true; name: string }
  | { ok: false; name: string; reason: string };

/**
 * Inti penghapusan satu aset, dipakai hapus tunggal maupun hapus massal.
 *
 * Urutannya dibalik dari biasanya: cek pakai → hapus baris DB → hapus objek.
 * Kalau objek gagal dihapus, file yatimnya tidak berbahaya (tak terpakai lagi),
 * sedangkan kalau DB dihapus dulu lalu proses mati, kita kehilangan jejaknya.
 */
async function deleteAssetById(assetId: string): Promise<DeleteOutcome> {
  const asset = await prisma.mediaAsset.findUnique({
    where: { id: assetId },
    include: { _count: { select: { derivations: true } } },
  });
  if (!asset) return { ok: false, name: "Gambar", reason: "Gambar sudah tidak ada." };

  // Aset yang punya turunannya dipakai sebagai asal-usul. Hapusinya berarti
  // hasil suntingan kehilangan jejaknya, jadi turunannya dibersihkan dulu.
  if (asset._count.derivations > 0) {
    return {
      ok: false,
      name: asset.filename,
      reason:
        `Gambar ini jadi asal-usul ${asset._count.derivations} hasil suntingan. ` +
        `Hapus hasil suntingannya dulu supaya jejaknya tidak putus.`,
    };
  }

  const usage = await findImageUsage(asset.url);
  if (usage.count > 0) {
    return {
      ok: false,
      name: asset.filename,
      reason:
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

  return { ok: true, name: asset.filename };
}

/** Hapus aset galeri. */
export async function deleteAssetAction(
  _prev: GalleryState,
  formData: FormData,
): Promise<GalleryState> {
  await requireAdmin();

  const parsed = id.safeParse(formData.get("id"));
  if (!parsed.success) return { error: "ID gambar tidak valid." };

  const result = await deleteAssetById(parsed.data);
  if (!result.ok) return { error: result.reason };

  await revalidatePublic();
  return { ok: "Gambar dihapus." };
}

/**
 * URL kembali setelah redirect. Dibatasi ke halaman galeri supaya parameter
 * `back` yang dimanipulasi tidak bisa mengalihkan admin ke domain lain.
 */
function backPath(value: FormDataEntryValue | null): string {
  const raw = typeof value === "string" ? value : "";
  return /^\/adm-cms-hb\/gallery(\?[^\s#]*)?$/.test(raw) ? raw : "/adm-cms-hb/gallery";
}

/** Tempel pesan ok/galat ke URL daftar, menghormati query yang sudah ada. */
function withMessage(base: string, key: "ok" | "galat", message: string): string {
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}${key}=${encodeURIComponent(message)}`;
}

/** Wrapper untuk `<form action={...}>` tombol hapus per kartu. */
export async function deleteAssetAndRedirectAction(formData: FormData): Promise<void> {
  const back = backPath(formData.get("back"));
  const result = await deleteAssetAction({}, formData);
  if (result.error) redirect(withMessage(back, "galat", result.error));
  if (result.ok) redirect(withMessage(back, "ok", result.ok));
  redirect(back);
}

/**
 * Hapus banyak aset sekaligus dari checkbox di grid.
 *
 * Setiap aset tetap melewati aturan yang sama dengan hapus tunggal (asal-usul
 * dan pemakaian), jadi sebagian bisa gagal sementara sisanya terhapus. Hasil
 * suntingan diproses lebih dulu supaya memilih asal + turunannya sekaligus
 * tidak diblokir aturan "asal-usul".
 */
export async function deleteAssetsAction(formData: FormData): Promise<void> {
  // Auth duluan — jangan sampai input apa pun diproses sebelum cek sesi.
  await requireAdmin();

  const back = backPath(formData.get("back"));
  const raw = formData.getAll("ids").map((value) => String(value));
  const parsed = z.array(id).min(1).max(200).safeParse(raw);
  if (!parsed.success) {
    redirect(withMessage(back, "galat", "Pilih minimal satu gambar."));
  }

  const unique = [...new Set(parsed.data)];
  const rows = await prisma.mediaAsset.findMany({
    where: { id: { in: unique } },
    select: { id: true, derivedFromId: true },
  });
  // `derivedFromId` terisi = hasil suntingan → didahulukan.
  const order = rows
    .sort((a, b) => Number(b.derivedFromId !== null) - Number(a.derivedFromId !== null))
    .map((row) => row.id);

  let deleted = 0;
  const failures: string[] = [];

  for (const assetId of order) {
    const result = await deleteAssetById(assetId);
    if (result.ok) deleted += 1;
    else failures.push(`${result.name}: ${result.reason}`);
  }

  if (deleted > 0) await revalidatePublic();

  if (deleted === 0) {
    redirect(withMessage(back, "galat", failures[0] ?? "Tidak ada gambar yang dihapus."));
  }

  if (failures.length > 0) {
    const shown = failures.slice(0, 3).join("; ");
    const rest = failures.length > 3 ? `; dan ${failures.length - 3} lainnya` : "";
    redirect(
      withMessage(
        back,
        "galat",
        `${deleted} gambar dihapus, ${failures.length} gagal: ${shown}${rest}`,
      ),
    );
  }

  redirect(withMessage(back, "ok", `${deleted} gambar dihapus.`));
}
