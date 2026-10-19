import { notFound } from "next/navigation";
import Link from "next/link";

import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { LiveEditor } from "@/components/admin/live-editor";
import { buildPackageSections } from "@/lib/admin/package-fields";
import { packagePreviewBase } from "@/lib/admin/preview-base";
import { omit } from "@/lib/admin/values";
import { requireSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

import { deletePackageAction, savePackageAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditPackagePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tersimpan?: string }>;
}) {
  await requireSessionUser();

  const { slug } = await params;
  const { tersimpan } = await searchParams;

  const [pkg, preview, categories, settings] = await Promise.all([
    prisma.package.findUnique({
      where: { slug },
      include: {
        category: { select: { slug: true, navLabel: true } },
        cardDays: { orderBy: { order: "asc" } },
        cardPrices: { orderBy: { order: "asc" } },
        cardFacilities: { orderBy: { order: "asc" } },
        schedule: { orderBy: { order: "asc" } },
        itinerary: { orderBy: { order: "asc" }, include: { items: { orderBy: { order: "asc" } } } },
        facilities: { orderBy: { order: "asc" }, include: { items: { orderBy: { order: "asc" } } } },
        notes: { orderBy: { order: "asc" } },
        gallery: { orderBy: { order: "asc" } },
        pricing: {
          include: {
            columns: { orderBy: { order: "asc" } },
            rows: { orderBy: { order: "asc" }, include: { values: true } },
            items: { orderBy: { order: "asc" } },
          },
        },
      },
    }),
    packagePreviewBase(slug),
    prisma.category.findMany({
      select: { slug: true, navLabel: true },
      orderBy: [{ order: "asc" }, { name: "asc" }],
    }),
    prisma.siteSettings.findFirst({ select: { waNumber: true, waGreeting: true, waMessage: true } }),
  ]);
  if (!pkg || !preview) notFound();

  const options = categories.map((c) => ({ value: c.slug, label: c.navLabel || c.slug }));
  const sections = buildPackageSections(options);

  /**
   * Nilai awal form.
   *
   * Baris tabel harga dibalik ke bentuk matriks: `pricingColumns` memakai id
   * kolom asli sebagai `key` supaya sel yang sudah tersimpan tetap menempel ke
   * kolomnya setelah editor dibuka ulang. Baris baru akan memakai `col_…`,
   * jadi dua bentuk id ini aman dipakai berdampingan.
   */
  const pricing = pkg.pricing
    ? {
        pricingKind: pkg.pricing.kind,
        pricingNote: pkg.pricing.note,
        pricingRowHeaderLabel: pkg.pricing.rowHeaderLabel,
        pricingColumns: pkg.pricing.columns.map((column) => ({
          key: column.id,
          label: column.label,
          cssClass: column.cssClass ?? "",
        })),
        pricingRows: pkg.pricing.rows.map((row) => ({
          label: row.label,
          values: Object.fromEntries(row.values.map((v) => [v.columnId, v.value])),
        })),
        pricingItems: pkg.pricing.items.map((item) => ({
          label: item.label,
          value: item.value,
          unit: item.unit ?? "",
        })),
      }
    : undefined;

  /**
   * Skalar form diambil dengan membuang kunci yang bukan milik form.
   *
   * `omit()` dipakai supaya halaman ini tidak perlu menyebut setiap kolom
   * `Package` satu per satu — kolom baru otomatis ikut masuk, dan `spec` +
   * allowlist di action tetap yang menentukan mana yang benar-benar tersimpan.
   */
  const scalars = omit(pkg, [
    "id",
    "createdAt",
    "updatedAt",
    "categoryId",
    "kind",
    "category",
    "cardDays",
    "cardPrices",
    "cardFacilities",
    "schedule",
    "itinerary",
    "facilities",
    "notes",
    "gallery",
    "pricing",
    "images",
  ]);

  const initial = {
    ...scalars,
    // Isian WhatsApp kosong = pakai pengaturan global, jadi nilai global
    // ditampilkan di field supaya admin bisa langsung menyunting pesan yang
    // sedang berlaku.
    waNumber: scalars.waNumber || settings?.waNumber || "",
    waGreeting: scalars.waGreeting || settings?.waGreeting || "",
    waMessage: scalars.waMessage || settings?.waMessage || "",
    ctaWaNumber: scalars.ctaWaNumber || scalars.waNumber || settings?.waNumber || "",
    ctaWaGreeting: scalars.ctaWaGreeting || scalars.waGreeting || settings?.waGreeting || "",
    categorySlug: pkg.category.slug,
    cardDays: pkg.cardDays,
    cardPrices: pkg.cardPrices,
    cardFacilities: pkg.cardFacilities,
    schedule: pkg.schedule,
    itinerary: pkg.itinerary,
    facilities: pkg.facilities,
    notes: pkg.notes,
    gallery: pkg.gallery,
    ...(pricing ?? {
      pricingKind: "TABLE",
      pricingNote: "",
      pricingRowHeaderLabel: "",
      pricingColumns: [],
      pricingRows: [],
      pricingItems: [],
    }),
  };

  const isLive = pkg.isPublished && pkg.hasDetailPage;

  return (
    <>
      {tersimpan ? (
        <p className="admin-notice" role="status">
          Paket tersimpan.
        </p>
      ) : null}

      {!isLive ? (
        <p className="admin-notice admin-notice--muted">
          Paket ini belum punya halaman publik. {pkg.isPublished ? "" : "Paketnya masih draft. "}
          {!pkg.hasDetailPage
            ? "Aktifkan “Punya halaman detail” di bagian Identitas untuk menerbitkan URL detailnya."
            : "Terbitkan paket untuk melihat halamannya."}
        </p>
      ) : null}

      <LiveEditor
        title={`Ubah ${pkg.name}`}
        backHref="/admin/paket"
        backLabel="Semua paket"
        sections={sections}
        initial={initial}
        action={savePackageAction}
        hidden={{ id: pkg.id }}
        preview={{ kind: "package", ...preview }}
      />

      <p className="admin-hint">
        Kategori saat ini:{" "}
        <Link href={`/admin/kategori/${pkg.category.slug}`}>{pkg.category.navLabel}</Link>. Mengubah
        kategori di atas akan memindahkan paket ini.
        {isLive ? (
          <>
            {" · "}
            <a href={`/${pkg.slug}`} target="_blank" rel="noreferrer">
              Lihat halaman publik
            </a>
          </>
        ) : null}
      </p>

      <form action={deletePackageAction} className="admin-danger-zone">
        <input type="hidden" name="id" value={pkg.id} />
        <h2>Hapus paket</h2>
        <p className="admin-hint">
          Itinerary, fasilitas, harga, dan galeri paket ini ikut terhapus. Tindakan ini tidak bisa
          dibatalkan.
        </p>
        <ConfirmSubmit confirm={`Hapus paket "${pkg.name}" beserta seluruh isinya?`}>
          Hapus paket
        </ConfirmSubmit>
      </form>
    </>
  );
}