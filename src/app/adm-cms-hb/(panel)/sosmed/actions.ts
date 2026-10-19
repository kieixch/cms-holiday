"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { FormState } from "@/components/admin/admin-form";
import type { Prisma } from "@/generated/prisma/client";
import { trySyncContentFile } from "@/lib/admin/content-export";
import { parseFields } from "@/lib/admin/fields";
import { SOSMED_META_FIELDS, sosmedFields } from "@/lib/admin/sosmed-fields";
import { buildValidator, errorMap } from "@/lib/admin/validate";
import { bumpContentVersion } from "@/lib/content-version";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/image";

const validator = buildValidator(sosmedFields);

const META_FIELDS = new Set<string>(SOSMED_META_FIELDS);

/**
 * Segmen publik yang bergantung pada dokumen link-bio: dokumennya sendiri.
 *
 * Halaman sosmed tidak pernah jadi kartu di beranda/kategori (`getPageCards`
 * menyaring `scope: "page"`), jadi tidak ada alasan merevalidasi beranda.
 */
function revalidatePublicPaths(slug: string) {
  revalidatePath(`/bio/${slug}`);
  revalidatePath("/adm-cms-hb/sosmed");
}

/**
 * Simpan halaman link-bio: buat baru kalau `id` tidak dikirim, ubah kalau ada.
 *
 * Halaman di sini selalu `scope: "sosmed"`. Saat mengubah, baris yang bukan
 * milik scope ini ditolak supaya editor Sosmed tidak bisa menimpa halaman
 * biasa lewat id yang salah.
 */
export async function saveSosmedAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "").trim();
  const result = validator.safeParse(parseFields(formData, sosmedFields));

  if (!result.success) {
    return { errors: errorMap(result.error) };
  }

  const data = result.data as Record<string, unknown>;

  const slug = slugify(String(data.slug ?? "") || String(data.title ?? ""));
  if (!slug) return { errors: { slug: "Slug harus berisi huruf atau angka." } };

  const clash = await prisma.htmlPage.findFirst({
    where: { slug, ...(id ? { NOT: { id } } : {}) },
    select: { id: true },
  });
  if (clash) return { errors: { slug: `Slug "${slug}" sudah dipakai halaman lain.` } };

  // Meta disimpan sebagai kolom `HtmlPage`; sisanya adalah isi halaman dan
  // disimpan utuh ke kolom JSON `bio` (`BioLinkPageData`). Pemisahan ini yang
  // membuat bagian `title`/`slug`/`order`/`isPublished` tetap bisa di-query
  // tanpa membongkar JSON.
  const title = String(data.title ?? "");
  const order = typeof data.order === "number" ? data.order : 0;
  const isPublished = data.isPublished === true;

  const bio: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (!META_FIELDS.has(key)) bio[key] = value;
  }
  const bioJson = bio as Prisma.InputJsonValue;

  let savedId = id;

  try {
    if (id) {
      const existing = await prisma.htmlPage.findUnique({
        where: { id },
        select: { scope: true },
      });
      if (!existing || existing.scope !== "sosmed") {
        return { message: "Halaman ini bukan bagian dari menu Sosmed." };
      }
      await prisma.htmlPage.update({
        where: { id },
        data: { title, slug, order, isPublished, bio: bioJson },
      });
    } else {
      const created = await prisma.htmlPage.create({
        data: { title, slug, order, isPublished, bio: bioJson, scope: "sosmed" },
      });
      savedId = created.id;
    }
  } catch (error) {
    return { message: `Gagal menyimpan: ${describe(error)}` };
  }

  // `redirect()` melempar NEXT_REDIRECT, jadi wajib berada DI LUAR try/catch.
  await trySyncContentFile();
  await bumpContentVersion();
  revalidatePublicPaths(slug);

  redirect(`/adm-cms-hb/sosmed/${savedId}?tersimpan=1`);
}

export async function deleteSosmedAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const page = await prisma.htmlPage.findUnique({
    where: { id },
    select: { slug: true, scope: true },
  });
  if (!page || page.scope !== "sosmed") return;

  await prisma.htmlPage.delete({ where: { id } });

  await trySyncContentFile();
  await bumpContentVersion();
  revalidatePublicPaths(page.slug);

  redirect("/adm-cms-hb/sosmed");
}

/**
 * Pesan error Prisma yang berguna untuk admin. Kode `P2002` (unik) diterjemahkan;
 * sisanya sengaja tidak ditampilkan supaya detail skema tidak bocor.
 */
function describe(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = String((error as { code: unknown }).code);
    if (code === "P2002") return "ada nilai unik yang bentrok, periksa slug.";
  }
  return "terjadi kesalahan di server.";
}
