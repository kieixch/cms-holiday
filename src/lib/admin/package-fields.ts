import type { PackageBodyData } from "@/components/site/views";

import type { Field } from "./fields";
import type { FieldSection } from "./sections";

/**
 * Spec form untuk `Package`, dikelompokkan per section halaman.
 *
 * Berbeda dari `category-fields.ts`, spec di sini memakai `FieldSection[]`
 * karena paket punya jauh lebih banyak kolom dan needs accordion bernomor di
 * panel editor. `id` tiap section sama dengan penanda `data-section` di
 * `@/components/site/views`, jadi klik section di live preview langsung membuka
 * group field yang mengaturnya.
 *
 * Kolom yang tidak ada di sini: `id`, `categoryId`, `kind`, `createdAt`,
 * `updatedAt`. `categoryId` dan `kind` disusun action dari `categorySlug`,
 * `createdAt`/`updatedAt` dikelola Prisma.
 *
 * Tiga kolom sengaja dibiarkan di luar form: `images` (dipakai importer
 * legacy, tidak pernah dirender), serta `galleryHasMore` dan
 * `galleryMoreLabel` (kolom sisa desain lama — `<GalleryGrid>` tidak
 * membacanya). Menawarkannya di editor hanya Akan memberi field yang
 * hasilnya tidak terlihat di halaman publik.
 */
export type PackageCategoryOption = { value: string; label: string };

/** Nama field yang tidak pernah masuk `prisma.package` langsung. */
export const PRICING_FIELDS = [
  "pricingKind",
  "pricingNote",
  "pricingRowHeaderLabel",
  "pricingColumns",
  "pricingRows",
  "pricingItems",
] as const;

export function buildPackageSections(categories: PackageCategoryOption[]): FieldSection[] {
  return [
    {
      id: "meta",
      title: "Identitas & Status",
      help: "Menentukan paket muncul di mana dan apakah punya halaman detail.",
      fields: [
        { kind: "text", name: "name", label: "Nama paket", required: true, width: "half" },
        {
          kind: "text",
          name: "slug",
          label: "Slug URL",
          width: "half",
          help: "Alamat halaman publik. Kosongkan untuk dibuat otomatis dari nama.",
        },
        {
          kind: "select",
          name: "categorySlug",
          label: "Kategori",
          required: true,
          width: "half",
          options: categories,
          help: "Dipakai untuk kartu di listing kategori dan paket terkait.",
        },
        { kind: "number", name: "order", label: "Urutan", width: "half", min: 0, max: 999 },
        {
          kind: "boolean",
          name: "hasDetailPage",
          label: "Punya halaman detail",
          width: "half",
          help: "Paket Open Trip asli tidak punya halaman detail. Menyalakannya membuat URL publik baru untuk paket ini.",
        },
        { kind: "boolean", name: "isPublished", label: "Publikasikan", width: "half" },
        { kind: "boolean", name: "isFeatured", label: "Kartu melebar penuh", width: "half" },
        { kind: "boolean", name: "showOnHome", label: "Tampilkan di beranda", width: "half" },
      ],
    },
    {
      id: "hero",
      title: "Hero",
      fields: [
        { kind: "text", name: "heroBadges", label: "Badge", list: true, width: "half" },
        { kind: "text", name: "heroTitle", label: "Judul hero", required: true, width: "half" },
        { kind: "text", name: "heroAccent", label: "Kata aksen", width: "half" },
        { kind: "text", name: "heroSuffix", label: "Kata akhiran", width: "half" },
        { kind: "textarea", name: "heroDescription", label: "Deskripsi", rows: 3, width: "full" },
        { kind: "strings", name: "heroDecos", label: "Dekorasi", width: "half" },
        {
          kind: "image",
          name: "heroImage",
          label: "Latar belakang",
          empty: "null",
          width: "half",
          help: "Gambar cinematic di belakang hero. Kosongkan untuk memakai foto galeri pertama seperti sebelumnya.",
        },
        {
          kind: "text",
          name: "heroImageAlt",
          label: "Alt latar belakang",
          empty: "null",
          width: "half",
          help: "Teks alternatif untuk pembaca layar dan SEO.",
        },
        {
          kind: "text",
          name: "ctaPrimaryLabel",
          label: "Tombol utama",
          width: "half",
          help: "Tombol WhatsApp di hero. Kosongkan untuk menyembunyikannya.",
        },
        {
          kind: "text",
          name: "heroWaLink",
          label: "Link rotator tombol",
          width: "half",
          help: "Opsional. Link alternatif (mis. Bitly) yang menggantikan wa.me untuk tombol WhatsApp hero. Kosongkan untuk memakai nomor WhatsApp situs.",
        },
        {
          kind: "text",
          name: "waNumber",
          label: "Nomor WhatsApp",
          placeholder: "628133111543",
          width: "half",
          disabledWhen: "heroWaLink",
          help: "Kosong = nomor WhatsApp situs dari Pengaturan.",
        },
        {
          kind: "text",
          name: "waGreeting",
          label: "Sapaan pesan otomatis",
          width: "half",
          disabledWhen: "heroWaLink",
          help: 'Ditempel di depan pesan, mis. "Halo". Kosong = sapaan dari Pengaturan.',
        },
        {
          kind: "textarea",
          name: "waMessage",
          label: "Pesan WhatsApp",
          rows: 2,
          width: "half",
          disabledWhen: "heroWaLink",
        },
        {
          kind: "text",
          name: "ctaSecondaryLabel",
          label: "Tombol sekunder",
          width: "half",
          help: 'Tombol gulir. Tujuannya mengikuti teks: "Lihat Itinerary" menuju itinerary, "Lihat Fasilitas" menuju fasilitas, dst.',
        },
        {
          kind: "text",
          name: "ctaSecondaryAnchor",
          label: "Anchor tombol sekunder",
          width: "half",
          help: "Dipakai hanya kalau teks tombol sekunder tidak dikenali. Contoh: itinerary.",
        },
      ],
    },
    {
      id: "card",
      title: "Kartu di Listing",
      help: "Tampilan ringkas paket di halaman kategori dan beranda. Judul kartu memakai kolom “Nama paket” di bagian Identitas & Status — terpisah dari judul hero.",
      fields: [
        { kind: "image", name: "cardImage", label: "Gambar kartu", empty: "null", width: "half" },
        { kind: "text", name: "cardImageAlt", label: "Alt gambar", empty: "null", width: "half" },
        { kind: "text", name: "cardTag", label: "Tag", width: "third" },
        { kind: "text", name: "cardLoc", label: "Lokasi", width: "third" },
        { kind: "text", name: "cardHomeLoc", label: "Lokasi (beranda)", width: "third" },
        { kind: "text", name: "cardRating", label: "Rating", width: "half" },
        { kind: "text", name: "cardHighlight", label: "Ringkasan beranda", width: "half" },
        {
          kind: "select",
          name: "cardLinkMode",
          label: "Tombol mengarah ke",
          width: "half",
          options: [
            { value: "detail", label: "Halaman detail" },
            { value: "whatsapp", label: "WhatsApp" },
          ],
        },
        { kind: "text", name: "cardButtonLabel", label: "Teks tombol", width: "half" },
        {
          kind: "text",
          name: "cardWaLink",
          label: "Link rotator tombol",
          width: "half",
          help: "Opsional. Dipakai hanya kalau tombol mengarah ke WhatsApp. Link alternatif (mis. Bitly) yang menggantikan wa.me; kosongkan untuk memakai nomor WhatsApp situs.",
        },
        { kind: "text", name: "cardVariant", label: "Varian kartu", width: "half" },
        { kind: "text", name: "cardPriceLabel", label: "Harga — label", width: "third" },
        { kind: "text", name: "cardPriceValue", label: "Harga — nilai", width: "third" },
        { kind: "text", name: "cardPriceUnit", label: "Harga — satuan", empty: "null", width: "third" },
        {
          kind: "repeater",
          name: "cardDays",
          label: "Baris hari",
          width: "full",
          itemTitleField: "label",
          children: [
            { kind: "text", name: "label", label: "Label", required: true, width: "third" },
            { kind: "text", name: "title", label: "Judul", width: "two-thirds" },
          ],
        },
        {
          kind: "repeater",
          name: "cardPrices",
          label: "Baris harga",
          width: "full",
          itemTitleField: "label",
          children: [
            { kind: "text", name: "label", label: "Label", required: true, width: "third" },
            { kind: "text", name: "value", label: "Nilai", required: true, width: "third" },
            { kind: "text", name: "unit", label: "Satuan", empty: "null", width: "third" },
          ],
        },
        {
          kind: "repeater",
          name: "cardFacilities",
          label: "Pill fasilitas",
          width: "full",
          itemTitleField: "label",
          children: [{ kind: "text", name: "label", label: "Label", required: true, width: "full" }],
        },
      ],
    },
    {
      id: "jadwal",
      title: "Jadwal",
      help: "Jadwal keberangkatan yang tampil di atas itinerary. Tiap baris = satu tanggal.",
      fields: [
        { kind: "text", name: "jadwalTag", label: "Tag", width: "half" },
        { kind: "text", name: "jadwalTitle", label: "Judul", width: "half" },
        { kind: "text", name: "jadwalAccent", label: "Kata aksen", width: "half" },
        { kind: "text", name: "jadwalSuffix", label: "Kata akhiran", width: "half" },
        { kind: "textarea", name: "jadwalDescription", label: "Deskripsi", rows: 2, width: "full" },
        { kind: "text", name: "jadwalAnchor", label: "Anchor", width: "half" },
        {
          kind: "repeater",
          name: "schedule",
          label: "Daftar jadwal",
          width: "full",
          itemTitleField: "description",
          children: [
            { kind: "number", name: "day", label: "Tanggal", required: true, width: "third", min: 1, max: 31 },
            { kind: "text", name: "month", label: "Bulan", required: true, width: "third", placeholder: "Oktober" },
            { kind: "number", name: "year", label: "Tahun", required: true, width: "third", min: 2020, max: 2100, placeholder: "2026" },
            { kind: "text", name: "description", label: "Deskripsi", width: "full", placeholder: "Sisa 5 seat" },
          ],
        },
      ],
    },
    {
      id: "itinerary",
      title: "Itinerary",
      fields: [
        { kind: "text", name: "itineraryTag", label: "Tag", width: "half" },
        { kind: "text", name: "itineraryTitle", label: "Judul", width: "half" },
        { kind: "text", name: "itineraryAccent", label: "Kata aksen", width: "half" },
        { kind: "text", name: "itinerarySuffix", label: "Kata akhiran", width: "half" },
        { kind: "textarea", name: "itineraryDescription", label: "Deskripsi", rows: 2, width: "full" },
        { kind: "text", name: "itineraryAnchor", label: "Anchor", width: "half" },
        {
          kind: "number",
          name: "itineraryColumns",
          label: "Kolom di desktop",
          width: "half",
          min: 1,
          max: 3,
          help: "Halaman asli: 2D1N 2 kolom, 3D2N 3 kolom, sisanya 1 kolom.",
        },
        {
          kind: "repeater",
          name: "itinerary",
          label: "Hari",
          width: "full",
          itemTitleField: "title",
          children: [
            { kind: "text", name: "emoji", label: "Emoji", width: "third", placeholder: "🌴" },
            { kind: "text", name: "label", label: "Label", required: true, width: "third" },
            { kind: "text", name: "title", label: "Judul", width: "third" },
            {
              kind: "repeater",
              name: "items",
              label: "Jadwal",
              width: "full",
              itemTitleField: "time",
              children: [
                { kind: "text", name: "time", label: "Waktu", width: "third", placeholder: "08:00" },
                { kind: "text", name: "text", label: "Kegiatan", width: "two-thirds" },
              ],
            },
          ],
        },
      ],
    },
    {
      id: "facilities",
      title: "Fasilitas",
      fields: [
        { kind: "text", name: "facilityTag", label: "Tag", width: "half" },
        { kind: "text", name: "facilityTitle", label: "Judul", width: "half" },
        { kind: "text", name: "facilityAccent", label: "Kata aksen", width: "half" },
        { kind: "text", name: "facilitySuffix", label: "Kata akhiran", width: "half" },
        { kind: "textarea", name: "facilityDescription", label: "Deskripsi", rows: 2, width: "full" },
        {
          kind: "repeater",
          name: "facilities",
          label: "Daftar fasilitas",
          width: "full",
          itemTitleField: "title",
          children: [
            {
              kind: "select",
              name: "variant",
              label: "Jenis",
              required: true,
              width: "third",
              options: [
                { value: "INCLUDE", label: "Termasuk" },
                { value: "EXCLUDE", label: "Tidak termasuk" },
              ],
            },
            { kind: "text", name: "title", label: "Judul", required: true, width: "two-thirds" },
            {
              kind: "repeater",
              name: "items",
              label: "Butir",
              width: "full",
              itemTitleField: "text",
              children: [
                { kind: "text", name: "icon", label: "Ikon", width: "third", placeholder: "🚌" },
                { kind: "text", name: "text", label: "Fasilitas", width: "two-thirds" },
              ],
            },
          ],
        },
        {
          kind: "repeater",
          name: "notes",
          label: "Catatan",
          width: "full",
          itemTitleField: "text",
          help: "Kotak catatan kuning di bawah halaman detail.",
          children: [
            { kind: "text", name: "icon", label: "Ikon", width: "third", placeholder: "ℹ️" },
            { kind: "text", name: "text", label: "Teks", width: "two-thirds", help: "Gunakan **tebal** untuk menyorot bagian penting." },
          ],
        },
      ],
    },
    {
      id: "pricing",
      title: "Harga",
      help: "Pilih tabel atau daftar harga. Tabel memakai kolom dan baris yang saling merujuk.",
      fields: [
        { kind: "text", name: "pricingTag", label: "Tag", width: "half" },
        { kind: "text", name: "pricingTitle", label: "Judul", width: "half" },
        { kind: "text", name: "pricingAccent", label: "Kata aksen", width: "half" },
        { kind: "text", name: "pricingSuffix", label: "Kata akhiran", width: "half" },
        { kind: "textarea", name: "pricingDescription", label: "Deskripsi", rows: 2, width: "full" },
        {
          kind: "select",
          name: "pricingKind",
          label: "Bentuk harga",
          width: "half",
          options: [
            { value: "TABLE", label: "Tabel (kolom × baris)" },
            { value: "ITEMS", label: "Daftar harga" },
          ],
        },
        { kind: "text", name: "pricingRowHeaderLabel", label: "Judul kolom pertama", empty: "null", width: "half" },
        { kind: "textarea", name: "pricingNote", label: "Catatan di bawah tabel", rows: 2, empty: "null", width: "full" },
        {
          kind: "repeater",
          name: "pricingColumns",
          label: "Kolom tabel",
          width: "full",
          itemTitleField: "label",
          keyField: "key",
          help: "Kolom yang dihapus ikut menghapus nilainya di semua baris.",
          children: [
            { kind: "text", name: "key", label: "Kunci kolom", width: "half", placeholder: "otomatis" },
            { kind: "text", name: "label", label: "Judul kolom", required: true, width: "half" },
            { kind: "text", name: "cssClass", label: "Kelas warna sel", empty: "null", width: "half", help: "Mis. price-hijau. Kosongkan untuk warna bawaan." },
          ],
        },
        {
          kind: "repeater",
          name: "pricingRows",
          label: "Baris tabel",
          width: "full",
          itemTitleField: "label",
          children: [
            { kind: "text", name: "label", label: "Label baris", required: true, width: "half" },
            {
              kind: "matrix",
              name: "values",
              label: "Nilai",
              columnsField: "pricingColumns",
              columnIdField: "key",
              columnLabelField: "label",
              width: "full",
              help: "Satu input per kolom yang terdaftar di atas.",
            },
          ],
        },
        {
          kind: "repeater",
          name: "pricingItems",
          label: "Daftar harga",
          width: "full",
          itemTitleField: "label",
          children: [
            { kind: "text", name: "label", label: "Label", required: true, width: "third" },
            { kind: "text", name: "value", label: "Nilai", required: true, width: "third" },
            { kind: "text", name: "unit", label: "Satuan", empty: "null", width: "third" },
          ],
        },
      ],
    },
    {
      id: "gallery",
      title: "Galeri",
      fields: [
        { kind: "text", name: "galleryTag", label: "Tag", width: "half" },
        { kind: "text", name: "galleryTitle", label: "Judul", width: "half" },
        { kind: "text", name: "galleryAccent", label: "Kata aksen", width: "half" },
        { kind: "text", name: "gallerySuffix", label: "Kata akhiran", width: "half" },
        { kind: "textarea", name: "galleryDescription", label: "Deskripsi", rows: 2, width: "full" },
        { kind: "number", name: "galleryColumns", label: "Kolom di desktop", width: "half", min: 1, max: 4 },
        {
          kind: "repeater",
          name: "gallery",
          label: "Foto",
          width: "full",
          children: [
            { kind: "image", name: "url", label: "Foto", required: true, width: "full" },
            { kind: "text", name: "alt", label: "Alt", width: "full" },
          ],
        },
      ],
    },
    {
      id: "cta",
      title: "Ajakan Booking",
      fields: [
        { kind: "text", name: "ctaTitle", label: "Judul blok CTA", width: "half" },
        { kind: "textarea", name: "ctaText", label: "Teks blok CTA", rows: 2, width: "full" },
        { kind: "text", name: "ctaLabel", label: "Teks tombol CTA", width: "half" },
        {
          kind: "text",
          name: "ctaWaNumber",
          label: "Nomor WhatsApp CTA",
          placeholder: "628133111543",
          width: "half",
          disabledWhen: "ctaWaLink",
          help: "Nomor tombol banner CTA paket ini. Kosong = nomor tombol hero paket/global.",
        },
        {
          kind: "text",
          name: "ctaWaGreeting",
          label: "Sapaan pesan otomatis CTA",
          width: "half",
          disabledWhen: "ctaWaLink",
          help: 'Ditempel di depan pesan banner CTA. Kosong = sapaan tombol hero paket/global.',
        },
        {
          kind: "textarea",
          name: "ctaMessage",
          label: "Pesan WhatsApp CTA",
          rows: 2,
          width: "half",
          disabledWhen: "ctaWaLink",
        },
        {
          kind: "text",
          name: "ctaWaLink",
          label: "Link rotator tombol CTA",
          width: "half",
          help: "Opsional. Link alternatif (mis. Bitly) yang menggantikan wa.me untuk tombol banner CTA halaman ini. Kosongkan untuk memakai nomor WhatsApp situs.",
        },
        {
          kind: "image",
          name: "ctaBackground",
          label: "Latar belakang gambar CTA",
          empty: "null",
          width: "half",
          help: "Opsional. Kosongkan untuk memakai foto latar global dari editor Beranda — Ajakan Booking.",
        },
      ],
    },
  ];
}

/** Spec datar, untuk `parseFields()` dan `buildValidator()`. */
export function packageFields(categories: PackageCategoryOption[]): Field[] {
  return buildPackageSections(categories).flatMap((section) => section.fields);
}

/* ------------------------------------------------------------------ */
/* Paket baru                                                          */
/* ------------------------------------------------------------------ */

/**
 * Bentuk satu paket yang belum pernah disimpan.
 *
 * Gabungan dua bentuk yang biasanya terpisah: data yang dibutuhkan
 * `<PackageBody>` / `<PackageCard>` untuk preview (`PackageBodyData`), dan
 * nilai awal form paket. Field tambahan di luar `PackageBodyData` adalah
 * `name` + `categorySlug` (dipakai action, bukan tampilan) dan enam field
 * `pricing*` — bentuk tabel harga di form memang series kolom/baris, sedangkan
 * di sisi tampilan sudah dirangkai jadi satu objek `pricing`.
 *
 * Satu objek dipakai untuk dua keperluan sekaligus supaya tidak ada dua daftar
 * default yang bisa berbeda: form baru selalu terisi, dan preview paket kosong
 * menampilkan hero/CTA dengan judul seksi yang sama seperti hasil simpan.
 */
export type PackageDraft = PackageBodyData & {
  name: string;
  categorySlug: string;
  /** Dipakai aturan tombol di preview; `savePackageAction` tetap mengikuti kategori. */
  kind: string;

  // Status
  isPublished: boolean;
  hasDetailPage: boolean;
  isFeatured: boolean;
  showOnHome: boolean;
  order: number;

  // Kartu ringkas
  cardImage: string | null;
  cardImageAlt: string | null;
  cardLoc: string | null;
  cardHomeLoc: string | null;
  cardTag: string | null;
  cardRating: string | null;
  cardHighlight: string | null;
  cardPriceLabel: string | null;
  cardPriceValue: string | null;
  cardPriceUnit: string | null;
  cardButtonLabel: string | null;
  cardWaLink: string | null;
  cardLinkMode: string | null;
  cardVariant: string;
  cardDays: { label: string; title: string }[];
  cardPrices: { label: string; value: string; unit: string | null }[];
  cardFacilities: { label: string }[];

  /** Bentuk harga: `TABLE` atau `ITEMS`. Lihat `PRICING_FIELDS`. */
  pricingKind: string;
  pricingNote: string | null;
  pricingRowHeaderLabel: string | null;
  pricingColumns: Record<string, unknown>[];
  pricingRows: Record<string, unknown>[];
  pricingItems: Record<string, unknown>[];
};

/**
 * Nilai awal paket yang baru dibuat di kategori tertentu.
 *
 * Semua default diambil dari `prisma/schema.prisma` supaya paket kosong langsung
 * punya judul seksi, gaya kartu, dan ajakan booking yang sama seperti paket
 * hasil isi manual. `hasDetailPage` mengikuti jenis kategori: paket Open Trip
 * di situs asli memang tidak punya halaman detail, jadi default-nya `false` dan
 * baru menyala kalau user mengaktifkannya sendiri.
 */
export function emptyPackage(categorySlug: string, kind: "OPEN_TRIP" | "PRIVATE"): PackageDraft {
  return {
    name: "",
    slug: "",
    categorySlug,
    // Tidak ada di `PackageBodyData`: Preview paket membutuhkannya untuk aturan
    // tombol, dan halaman publik tidak pernah membangun preview dari draft.
    kind,
    cardLinkMode: kind === "OPEN_TRIP" ? "whatsapp" : "detail",

    // Status
    isPublished: true,
    hasDetailPage: kind !== "OPEN_TRIP",
    isFeatured: false,
    showOnHome: false,
    order: 0,

    // Kartu
    cardImage: null,
    cardImageAlt: null,
    cardLoc: null,
    cardHomeLoc: null,
    cardTag: null,
    cardRating: null,
    cardHighlight: null,
    cardPriceLabel: null,
    cardPriceValue: null,
    cardPriceUnit: null,
    cardButtonLabel: null,
    cardWaLink: null,
    cardVariant: "default",
    cardDays: [],
    cardPrices: [],
    cardFacilities: [],

    // Hero & CTA
    heroBadges: [],
    heroTitle: "",
    heroAccent: "",
    heroSuffix: "",
    heroDescription: "",
    heroDecos: [],
    heroImage: null,
    heroImageAlt: null,
    heroWaLink: "",
    ctaPrimaryLabel: "💬 Booking via WhatsApp",
    ctaSecondaryLabel: "📋 Lihat Itinerary",
    ctaSecondaryAnchor: "#itinerary",
    ctaTitle: "",
    ctaText: "",
    ctaLabel: "💬 Chat & Booking Sekarang",
    ctaMessage: "",
    ctaWaNumber: "",
    ctaWaGreeting: "",
    ctaWaLink: "",
    ctaBackground: null,
    waMessage: "",
    waNumber: "",
    waGreeting: "",

    // Seksi
    jadwalTag: "Jadwal",
    jadwalTitle: "Jadwal",
    jadwalAccent: "Keberangkatan",
    jadwalSuffix: "",
    jadwalDescription: "",
    jadwalAnchor: "jadwal",
    schedule: [],
    itineraryTag: "Itinerary",
    itineraryTitle: "Day by Day,",
    itineraryAccent: "No Boring Moments",
    itinerarySuffix: "",
    itineraryDescription: "",
    itineraryAnchor: "itinerary",
    itineraryColumns: 1,
    itinerary: [],
    facilityTag: "Fasilitas",
    facilityTitle: "Udah Termasuk",
    facilityAccent: "Apa Aja?",
    facilitySuffix: "",
    facilityDescription: "",
    facilities: [],
    notes: [],
    pricingTag: "Harga Paket",
    pricingTitle: "Pilih Sesuai",
    pricingAccent: "Jumlah Squad",
    pricingSuffix: "",
    pricingDescription: "",
    galleryTag: "Galeri",
    galleryTitle: "Intip",
    galleryAccent: "Keseruannya",
    gallerySuffix: "",
    galleryDescription: "",
    galleryColumns: 3,
    gallery: [],

    /**
     * Bentuk tabel harga di sisi tampilan.
     *
     * `null` sampai ada baris yang benar-benar diisi: `<PackageBody>` memakai
     * `pricing` sebagai penandasection dan memang tidak merender apa pun kalau
     * belum ada. Field `pricing*` di bawahnya yang menyimpan isinya.
     */
    pricing: null,
    pricingKind: "TABLE",
    pricingNote: null,
    pricingRowHeaderLabel: null,
    pricingColumns: [],
    pricingRows: [],
    pricingItems: [],
  };
}