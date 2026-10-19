"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { FormState } from "@/components/admin/admin-form";
import type { Prisma } from "@/generated/prisma/client";
import { categoryFields } from "@/lib/admin/category-fields";
import { refreshAuditBaseline } from "@/lib/admin/audit-baseline";
import { trySyncContentFile } from "@/lib/admin/content-export";
import { bumpContentVersion } from "@/lib/content-version";
import { parseFields } from "@/lib/admin/fields";
import { buildValidator, errorMap } from "@/lib/admin/validate";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/image";

const validator = buildValidator(categoryFields);

/**
 * Halaman publik yang bergantung pada sebuah kategori.
 *
 * Kategori dan paket berbagi route dinamis `/[slug]`, jadi alamat publiknya
 * persis slug-nya. Paket di kategori ikut disegarkan karena kartu "paket
 * serupa" mereka membaca kategori yang sama.
 */
function revalidateCategory(slug: string) {
  revalidatePath("/");
  revalidatePath("/adm-cms-hb/kategori");
  revalidatePath(`/adm-cms-hb/kategori/${slug}`);
  revalidatePath(`/${slug}`);
}

/** Slug paket di sebuah kategori, untuk disegarkan bareng kategorinya. */
async function revalidatePackagesOf(categorySlug: string) {
  const packages = await prisma.package.findMany({
    where: { category: { slug: categorySlug } },
    select: { slug: true },
  });
  for (const pkg of packages) revalidatePath(`/${pkg.slug}`);
}

/**
 * Simpan kategori: buat baru kalau `id` tidak dikirim, ubah kalau ada.
 *
 * Relasi `benefits` ditulis ulang penuh — baris yang tidak lagi ada di form
 * ikut dihapus. Prisma tidak menyediakan "upsert daftar anak" tanpa menghapus
 * semua orang dulu, jadi ini satu-satunya cara yang benar; admin tidak pernah
 * bisa menyisipkan keunggulan lewat form ini, jadi tidak ada baris yang bisa
 * hilang diam-diam.
 */
export async function saveCategoryAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "").trim();
  const result = validator.safeParse(parseFields(formData, categoryFields));

  if (!result.success) {
    return { errors: errorMap(result.error) };
  }

  const data = result.data as Record<string, unknown>;

  // Slug: pakai yang diketik admin, atau turunkan dari nama. Dicek di sini
  // supaya bentrok `slug` unique dikembalikan sebagai pesan yang bisa dibaca,
  // bukan error Prisma P2002 yang tidak bermakna bagi admin.
  const slug = slugify(String(data.slug ?? "") || String(data.name ?? ""));
  if (!slug) return { errors: { slug: "Slug harus berisi huruf atau angka." } };

  const clash = await prisma.category.findFirst({
    where: { slug, ...(id ? { NOT: { id } } : {}) },
    select: { id: true },
  });
  if (clash) return { errors: { slug: `Slug "${slug}" sudah dipakai kategori lain.` } };

  const { benefits, ...scalars } = data;
  const rows = (benefits as Record<string, unknown>[]).map((benefit, index) => ({
    icon: String(benefit.icon ?? ""),
    title: String(benefit.title ?? ""),
    description: String(benefit.description ?? ""),
    // `order` yang dikosongkan diisi dengan posisi baris supaya urutan hasil
    // ketikan admin tetap sama dengan urutan tampilannya.
    order: typeof benefit.order === "number" && !Number.isNaN(benefit.order) ? benefit.order : index,
    isHomepage: false,
  }));

  // `scalars` datang dari zod sebagai `Record<string, unknown>`, jadi Prisma
  // tidak bisa memverifikasinya. Klaim bertipe di sini memindahkan
  // tanggung jawab itu ke spec `categoryFields` + validator, yang sudah
  // dipastikan hanya menghasilkan kolom yang ada di `Category`.
  const columns = scalars as Omit<Prisma.CategoryCreateInput, "benefits" | "packages">;

  try {
    if (id) {
      // `deleteMany` + `create` = tulis ulang penuh. Prisma tidak punya
      // operasi "sisakan anak yang tidak disebut", jadi daftar keunggulan
      // harus dikirim utuh setiap kali — persis seperti yang dirender form.
      const update: Prisma.CategoryUpdateInput = {
        ...columns,
        slug,
        benefits: { deleteMany: {}, create: rows },
      };
      await prisma.category.update({ where: { id }, data: update });
    } else {
      const create: Prisma.CategoryCreateInput = {
        ...columns,
        slug,
        benefits: { create: rows },
      };
      await prisma.category.create({ data: create });
    }
  } catch (error) {
    return { message: `Gagal menyimpan: ${describe(error)}` };
  }

  await trySyncContentFile();
  await refreshAuditBaseline();
  await bumpContentVersion();
  revalidateCategory(slug);
  await revalidatePackagesOf(slug);

  redirect(`/adm-cms-hb/kategori/${slug}?tersimpan=1`);
}

export async function deleteCategoryAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const category = await prisma.category.findUnique({
    where: { id },
    select: { slug: true, packages: { select: { slug: true } } },
  });
  if (!category) return;

  await prisma.category.delete({ where: { id } });

  await trySyncContentFile();
  await refreshAuditBaseline();
  await bumpContentVersion();
  revalidateCategory(category.slug);
  for (const pkg of category.packages) revalidatePath(`/${pkg.slug}`);

  redirect("/adm-cms-hb/kategori");
}

/**
 * Pesan error Prisma yang berguna untuk admin.
 *
 * Kode `P2002` (unik) dan `P2003` (foreign key) paling sering terjadi dan
 * harus diterjemahkan; sisanya sengaja tidak ditampilkan supaya detail
 * skema tidak bocor ke antarmuka.
 */
function describe(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = String((error as { code: unknown }).code);
    if (code === "P2002") return "ada nilai unik yang bentrok, periksa slug.";
    if (code === "P2003") return "masih ada data lain yang menunjuk ke kategori ini.";
  }
  return "terjadi kesalahan di server.";
}
