"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { FormState } from "@/components/admin/admin-form";
import type { Prisma } from "@/generated/prisma/client";
import { refreshAuditBaseline } from "@/lib/admin/audit-baseline";
import { trySyncContentFile } from "@/lib/admin/content-export";
import { parseFields } from "@/lib/admin/fields";
import { halamanFields } from "@/lib/admin/halaman-fields";
import { buildValidator, errorMap } from "@/lib/admin/validate";
import { bumpContentVersion } from "@/lib/content-version";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/image";

const validator = buildValidator(halamanFields);

/**
 * Segmen publik yang bergantung pada kartu halaman: beranda, tiap kategori
 * yang memuat kartu, dan dokumennya sendiri.
 *
 * Kategori di-`revalidatePath` dengan slug konkret (bukan `/[slug]` bertipe
 * `"page"`). Halaman kategori diprerender saat build, dan `revalidatePath`
 * dengan pola dinamis tidak benar-benar membuang entri cache per-URL di
 * server produksi — akibatnya kartu baru tidak muncul sampai build ulang.
 * Slug nyata membuang entri yang tepat.
 */
function revalidatePublicPaths(slug: string, categorySlugs: string[] = []) {
  revalidatePath("/");
  for (const categorySlug of new Set(categorySlugs)) {
    if (categorySlug) revalidatePath(`/${categorySlug}`);
  }
  revalidatePath(`/halaman/${slug}`);
  revalidatePath("/admin/halaman");
}

/**
 * Simpan halaman HTML: buat baru kalau `id` tidak dikirim, ubah kalau ada.
 *
 * Slug dicek di sini (bukan lewat validator) supaya bentrok `slug` unique
 * dikembalikan sebagai pesan yang bisa dibaca admin, bukan error P2002.
 */
export async function saveHalamanAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "").trim();
  const result = validator.safeParse(parseFields(formData, halamanFields));

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

  // Kategori yang sebelumnya memuat kartu ini juga perlu di-revalidate: kalau
  // penempatannya diubah, kartu harus hilang dari kategori lamanya tanpa
  // menunggu build ulang.
  const previous = id
    ? await prisma.htmlPage.findUnique({ where: { id }, select: { categorySlugs: true } })
    : null;
  const nextCategories = Array.isArray(data.categorySlugs) ? (data.categorySlugs as string[]) : [];

  // `data` datang dari zod sebagai `Record<string, unknown>`; klaim bertipe di
  // sini memindahkan tanggung jawab ke spec `halamanFields` + validator, yang
  // hanya menghasilkan kolom yang ada di model `HtmlPage`.
  const columns = data as Omit<Prisma.HtmlPageCreateInput, "slug">;

  // Id hasil create dipakai tujuan redirect supaya editor baru langsung
  // membuka halaman yang baru saja dibuat.
  let savedId = id;

  try {
    if (id) {
      await prisma.htmlPage.update({ where: { id }, data: { ...columns, slug } });
    } else {
      const created = await prisma.htmlPage.create({ data: { ...columns, slug } });
      savedId = created.id;
    }
  } catch (error) {
    return { message: `Gagal menyimpan: ${describe(error)}` };
  }

  // `redirect()` melempar NEXT_REDIRECT, jadi wajib berada DI LUAR try/catch
  // — kalau tidak, lemparannya tertangkap sendiri dan sukses jadi "gagal".
  await trySyncContentFile();
  await refreshAuditBaseline();
  await bumpContentVersion();
  revalidatePublicPaths(slug, [...nextCategories, ...(previous?.categorySlugs ?? [])]);

  redirect(`/admin/halaman/${savedId}?tersimpan=1`);
}

export async function deleteHalamanAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const page = await prisma.htmlPage.findUnique({
    where: { id },
    select: { slug: true, categorySlugs: true },
  });
  if (!page) return;

  await prisma.htmlPage.delete({ where: { id } });

  await trySyncContentFile();
  await refreshAuditBaseline();
  await bumpContentVersion();
  revalidatePublicPaths(page.slug, page.categorySlugs);

  redirect("/admin/halaman");
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
