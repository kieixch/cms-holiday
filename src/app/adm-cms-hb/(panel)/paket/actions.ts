"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { FormState } from "@/components/admin/admin-form";
import type { Prisma } from "@/generated/prisma/client";
import { parseFields } from "@/lib/admin/fields";
import { refreshAuditBaseline } from "@/lib/admin/audit-baseline";
import { trySyncContentFile } from "@/lib/admin/content-export";
import { bumpContentVersion } from "@/lib/content-version";
import { syncDetailLinks } from "@/lib/admin/package-detail-links";
import { packageFields, PRICING_FIELDS, type PackageCategoryOption } from "@/lib/admin/package-fields";
import { PACKAGE_DERIVED, PACKAGE_RELATIONS, PACKAGE_SCALARS } from "@/lib/admin/package-scalars";
import { buildValidator, errorMap } from "@/lib/admin/validate";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/image";

/**
 * Simpan paket beserta seluruh relasinya.
 *
 * Semua relasi anak ditulis ulang penuh (`deleteMany` + `create`): daftar
 * itinerary, fasilitas, harga, galeri, dan catatan hanya bisa disunting lewat
 * form ini, jadi tidak ada baris yang bisa hilang diam-diam. Satu pengecualian
 * yang perlu diperhatikan adalah tabel harga — kolom dan barisnya saling
 * merujuk lewat `PriceValue`, jadi kolom harus dibuat lebih dulu untuk
 * memetakan `key` kolom yang dikirim client ke id asli.
 */

/** Bentuk draft yang keluar dari `parseFields()` + validator. */
type Draft = Record<string, unknown>;

/** Bentuk yang di-spread ke `prisma.package.create()` / `.update()`. */
type PackageScalars = Omit<
  Prisma.PackageCreateInput,
  | "category"
  | "schedule"
  | "itinerary"
  | "facilities"
  | "pricing"
  | "gallery"
  | "notes"
  | "cardDays"
  | "cardPrices"
  | "cardFacilities"
>;

function str(value: unknown, fallback = ""): string {
  return value === null || value === undefined ? fallback : String(value);
}

function strOrNull(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

function rows(value: unknown): Draft[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Draft => typeof item === "object" && item !== null);
}

async function categoryOptions(): Promise<PackageCategoryOption[]> {
  const categories = await prisma.category.findMany({
    select: { slug: true, navLabel: true },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });
  return categories.map((c) => ({ value: c.slug, label: c.navLabel || c.slug }));
}

/** Baris iterator yang tidak bergantung pada isi `key` kolom. */
function orderOf(value: unknown, index: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : index;
}

export async function savePackageAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const categories = await categoryOptions();
  const fields = packageFields(categories);
  const result = buildValidator(fields).safeParse(parseFields(formData, fields));

  if (!result.success) return { errors: errorMap(result.error) };

  const data = result.data as Draft;
  const id = String(formData.get("id") ?? "").trim();

  const name = str(data.name).trim();
  const slug = slugify(str(data.slug) || name);
  if (!slug) return { errors: { slug: "Slug harus berisi huruf atau angka." } };

  const categorySlug = str(data.categorySlug);
  const category = await prisma.category.findUnique({
    where: { slug: categorySlug },
    select: { id: true, slug: true, kind: true },
  });
  if (!category) {
    return { errors: { categorySlug: "Kategori tidak ditemukan. Pilih dari daftar." } };
  }

  const clash = await prisma.package.findFirst({
    where: { slug, ...(id ? { NOT: { id } } : {}) },
    select: { id: true },
  });
  if (clash) return { errors: { slug: `Slug "${slug}" sudah dipakai paket lain.` } };

/**
   * Sisakan kolom yang benar-benar milik `Package` sebelum di-spread ke Prisma.
   *
   * Dipakai allowlist, bukan sekadar membuang nama yang "@tahu" relasi:
   * `parseFields()` mengembalikan tepat nama-nama di spec, jadi nama lain apa pun
   * di `data` berarti spec dan model sudah tidak sinkron. Kalau itu diteruskan
   * ke Prisma, error-nya muncul sebagai "Unknown argument" yang sulit
   * ditelusuri; kalau dibuang diam-diam, kolomnya hilang tanpa jejak. Jadi
   * keduanya dicek, dan nama asing dikembalikan sebagai pesan error.
   */
  const pricing: Draft = {};
  for (const key of PRICING_FIELDS) pricing[key] = data[key];

  const ignored = new Set<string>([
    ...PRICING_FIELDS,
    ...PACKAGE_RELATIONS,
    ...PACKAGE_DERIVED,
    "categorySlug",
  ]);
  const scalars: Draft = {};
  const stray: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (ignored.has(key)) continue;
    if ((PACKAGE_SCALARS as readonly string[]).includes(key)) scalars[key] = value;
    else stray.push(key);
  }
  if (stray.length > 0) {
    return { message: `Kolom tidak dikenal pada form paket: ${stray.join(", ")}` };
  }

  /**
   * `kind` mengikuti kategori, bukan form. Paket tidak punya pilihan jenis
   * sendiri, dan membiarkan begitu membuat `kind` tertinggal begitu paket
   * dipindah ke kategori lain — renderer memakai `category.kind`, jadi
   * ketidakcocokan ini diam-diam mengubah tampilan.
   *
   * Cast di sini tetap perlu karena `scalars` bertipe `Record<string,
   * unknown>`; keamanannya datang dari allowlist di atas, bukan dari cast-nya.
   */
  const columns = {
    ...scalars,
    kind: category.kind,
    ...syncDetailLinks({
      kind: category.kind,
      hasDetailPage: scalars.hasDetailPage === true,
      cardLinkMode: str(scalars.cardLinkMode, "whatsapp"),
      cardButtonLabel: str(scalars.cardButtonLabel),
      ctaPrimaryLabel: str(scalars.ctaPrimaryLabel),
    }),
  } as PackageScalars;

  const cardDays = rows(data.cardDays).map((item, index) => ({
    label: str(item.label),
    title: str(item.title),
    order: orderOf(item.order, index),
  }));

  const cardPrices = rows(data.cardPrices).map((item, index) => ({
    label: str(item.label),
    value: str(item.value),
    unit: strOrNull(item.unit),
    order: orderOf(item.order, index),
  }));

  const cardFacilities = rows(data.cardFacilities).map((item, index) => ({
    label: str(item.label),
    order: orderOf(item.order, index),
  }));

  /**
   * Jadwal keberangkatan. Baris tanpa bulan dibuang — tanggal dan tahun tanpa
   * nama bulan tidak akan bisa ditampilkan dengan benar di halaman publik.
   */
  const schedule = rows(data.schedule)
    .filter((item) => str(item.month).trim() !== "")
    .map((item, index) => ({
      day: str(item.day).trim(),
      month: str(item.month).trim(),
      year: str(item.year).trim(),
      description: str(item.description),
      order: orderOf(item.order, index),
    }));

  const itinerary = rows(data.itinerary).map((item, index) => ({
    emoji: str(item.emoji, "🌴"),
    label: str(item.label),
    title: str(item.title),
    order: orderOf(item.order, index),
    items: {
      create: rows(item.items).map((child, childIndex) => ({
        time: str(child.time),
        text: str(child.text),
        order: orderOf(child.order, childIndex),
      })),
    },
  }));

  const facilities = rows(data.facilities).map((item, index) => ({
    variant: str(item.variant, "INCLUDE") as Prisma.FacilityGroupCreateWithoutPackageInput["variant"],
    title: str(item.title),
    order: orderOf(item.order, index),
    items: {
      create: rows(item.items).map((child, childIndex) => ({
        icon: str(child.icon),
        text: str(child.text),
        order: orderOf(child.order, childIndex),
      })),
    },
  }));

  const notes = rows(data.notes).map((item, index) => ({
    icon: str(item.icon, "ℹ️"),
    text: str(item.text),
    order: orderOf(item.order, index),
  }));

  const gallery = rows(data.gallery)
    .filter((item) => str(item.url).trim() !== "")
    .map((item, index) => ({
      url: str(item.url).trim(),
      alt: str(item.alt),
      order: orderOf(item.order, index),
    }));

  /**
   * Kolom dibuat lebih dulu supaya `key` yang dikirim client (mis. `col_k3f…`)
   * bisa dipetakan ke id yang benar-benar dibuat Prisma. Baris harga ikut
   * dibuat setelahnya, menunjuk id kolom tersebut.
   */
  const priceColumns = rows(pricing.pricingColumns)
    .map((item, index) => ({
      key: str(item.key) || `col-${index}`,
      label: str(item.label),
      cssClass: strOrNull(item.cssClass),
      order: orderOf(item.order, index),
    }))
    .filter((column) => column.label.trim() !== "");

  const priceRows = rows(pricing.pricingRows)
    .map((item, index) => ({
      label: str(item.label),
      order: orderOf(item.order, index),
      cells:
        typeof item.values === "object" && item.values !== null && !Array.isArray(item.values)
          ? (item.values as Record<string, unknown>)
          : {},
    }))
    .filter((row) => row.label.trim() !== "");

  const priceItems = rows(pricing.pricingItems).map((item, index) => ({
    label: str(item.label),
    value: str(item.value),
    unit: strOrNull(item.unit),
    order: orderOf(item.order, index),
  }));

  const priceChildren = {
    kind: str(pricing.pricingKind, "TABLE") as Prisma.PricingCreateWithoutPackageInput["kind"],
    note: strOrNull(pricing.pricingNote),
    rowHeaderLabel: strOrNull(pricing.pricingRowHeaderLabel),
  };

  try {
    if (id) {
      // Tulis ulang penuh: baris yang tidak lagi ada di form ikut dihapus.
      // Timeout dinaikkan dari default 5 dtk karena banyak relasi ditulis
      // ulang berurutan (schedule, itinerary, gallery, pricing, dll).
      await prisma.$transaction(
        async (tx) => {
          await tx.package.update({
            where: { id },
            data: {
              ...columns,
              name,
              slug,
              category: { connect: { id: category.id } },
              cardDays: { deleteMany: {}, create: cardDays },
              cardPrices: { deleteMany: {}, create: cardPrices },
              cardFacilities: { deleteMany: {}, create: cardFacilities },
              schedule: { deleteMany: {}, create: schedule },
              itinerary: { deleteMany: {}, create: itinerary },
              facilities: { deleteMany: {}, create: facilities },
              notes: { deleteMany: {}, create: notes },
              gallery: { deleteMany: {}, create: gallery },
            },
          });

          // Tabel harga ditulis ulang penuh oleh `writePricing` (ia memanggil
          // `pricing.deleteMany` sendiri, aman kalau tabelnya belum pernah
          // dibuat — paket Open Trip bawaan misalnya). `pricing: { delete: true }`
          // di update tadi tidak dipakai karena Prisma menolak `delete` kalau
          // barisnya tidak ada (P2025).
          await writePricing(tx, id, priceChildren, priceColumns, priceRows, priceItems);
        },
        { timeout: 30_000 },
      );
    } else {
      const created = await prisma.package.create({
        data: {
          ...columns,
          name,
          slug,
          category: { connect: { id: category.id } },
          cardDays: { create: cardDays },
          cardPrices: { create: cardPrices },
          cardFacilities: { create: cardFacilities },
          schedule: { create: schedule },
          itinerary: { create: itinerary },
          facilities: { create: facilities },
          notes: { create: notes },
          gallery: { create: gallery },
        },
        select: { id: true },
      });

      await prisma.$transaction(
        (tx) => writePricing(tx, created.id, priceChildren, priceColumns, priceRows, priceItems),
        { timeout: 30_000 },
      );
    }
  } catch (error) {
    console.error("savePackageAction error:", error);
    return { message: `Gagal menyimpan: ${describe(error)}` };
  }

  await trySyncContentFile();
  await refreshAuditBaseline();
  await bumpContentVersion();
  revalidatePackage(slug, category.slug);
  redirect(`/adm-cms-hb/paket/${slug}?tersimpan=1`);
}

type PriceChildren = Omit<Prisma.PricingCreateWithoutPackageInput, "package">;
type PriceColumnDraft = { key: string; label: string; cssClass: string | null; order: number };
type PriceRowDraft = { label: string; order: number; cells: Record<string, unknown> };
type PriceItemDraft = { label: string; value: string; unit: string | null; order: number };

/**
 * Tulis tabel harga untuk sebuah paket.
 *
 * Kolom harus dibuat lebih dulu: nilai sel dikirim client sebagai
 * `{ [keyKolom]: teks }`, dan hanya baris `PriceValue` yang bisa menunjuk ke
 * id kolom asli. Baris tanpa satu pun sel terisi dilewati supaya tabel tidak
 * menyimpan baris kosong — baris seperti itu tetap terlihat di editor, tapi
 * tidak layak disimpan.
 */
async function writePricing(
  tx: Prisma.TransactionClient,
  packageId: string,
  priceChildren: PriceChildren,
  priceColumns: PriceColumnDraft[],
  priceRows: PriceRowDraft[],
  priceItems: PriceItemDraft[],
) {
  await tx.pricing.deleteMany({ where: { packageId } });

  if (priceColumns.length === 0 && priceRows.length === 0 && priceItems.length === 0) return;

  const created = await tx.pricing.create({
    data: { package: { connect: { id: packageId } }, ...priceChildren },
    select: { id: true },
  });

  const idByKey = new Map<string, string>();
  for (const [index, column] of priceColumns.entries()) {
    const createdColumn = await tx.priceColumn.create({
      data: {
        pricingId: created.id,
        label: column.label,
        cssClass: column.cssClass,
        order: column.order ?? index,
      },
      select: { id: true },
    });
    idByKey.set(column.key, createdColumn.id);
  }

  for (const [index, row] of priceRows.entries()) {
    const values = Object.entries(row.cells)
      .map(([key, value]) => ({ columnId: idByKey.get(key), value: String(value ?? "").trim() }))
      // Sel kosong tidak disimpan. Sel milik kolom yang sudah dihapus ikut
      // dibuang karena `idByKey` tidak lagi punya kuncinya.
      .filter((cell): cell is { columnId: string; value: string } =>
        typeof cell.columnId === "string" && cell.value !== "",
      );
    if (values.length === 0) continue;
    await tx.priceRow.create({
      data: {
        pricingId: created.id,
        label: row.label,
        order: row.order ?? index,
        values: { create: values },
      },
    });
  }

  for (const [index, item] of priceItems.entries()) {
    await tx.priceItem.create({
      data: { pricingId: created.id, ...item, order: item.order ?? index },
    });
  }
}

function revalidatePackage(slug: string, categorySlug: string) {
  revalidatePath("/adm-cms-hb/paket");
  revalidatePath(`/adm-cms-hb/paket/${slug}`);
  revalidatePath(`/adm-cms-hb/kategori/${categorySlug}`);
  // Kategori memuat kartu paket ini, dan paket bisa pindah kategori.
  revalidatePath(`/${slug}`);
  revalidatePath(`/${categorySlug}`);
  revalidatePath("/");
}

export async function deletePackageAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const pkg = await prisma.package.findUnique({
    where: { id },
    select: { slug: true, category: { select: { slug: true } } },
  });
  if (!pkg) return;

  await prisma.package.delete({ where: { id } });

  await trySyncContentFile();
  await refreshAuditBaseline();
  await bumpContentVersion();
  revalidatePackage(pkg.slug, pkg.category.slug);
  redirect("/adm-cms-hb/paket");
}

function describe(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = String((error as { code: unknown }).code);
    if (code === "P2002") return "ada nilai unik yang bentrok, periksa slug.";
    if (code === "P2003") return "masih ada data lain yang menunjuk ke paket ini.";
    return `Prisma ${code}: ${(error as { message?: string }).message || "terjadi kesalahan"}`;
  }
  if (error instanceof Error) return error.message;
  return "terjadi kesalahan di server.";
}