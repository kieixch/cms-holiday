import type { Field } from "./fields";
import { flattenSections, type FieldSection } from "./sections";

/**
 * Tombol on/off satu seksi beranda.
 *
 * Hero dan CTA tidak memakainya — keduanya selalu tampil. Untuk seksi lain,
 * checkbox ini yang menyembunyikan/menampilkan seluruh blok di beranda.
 */
function sectionToggle(name: string): Field {
  return {
    kind: "boolean",
    name,
    label: "Tampilkan seksi ini",
    width: "full",
    help: "Hilangkan centang untuk menyembunyikan seksi ini dari beranda.",
  };
}

/**
 * Spec form untuk halaman beranda.
 *
 * Isi beranda terbagi dua: kolom `SiteSettings` (`homeHero*`, `cta*`) dan tiga
 * tabel terpisah (`HomeStat`, `Benefit` dengan `isHomepage`, `Testimonial`).
 * Semuanya dikumpulkan di sini supaya satu form bisa menyunting seluruh
 * beranda, dan `id` tiap section tetap cocok dengan penanda `data-section` di
 * live preview.
 *
 * Kolom `SiteSettings` yang tidak ada di spec — identitas situs, kontak, footer
 * — sengaja tidak ikut: itu bagian pengaturan umum, bukan isi beranda.
 */
export const homeSections: FieldSection[] = [
  {
    id: "hero",
    title: "Hero",
    fields: [
      { kind: "text", name: "homeHeroBadges", label: "Badge", list: true, width: "half" },
      { kind: "text", name: "homeHeroTitle", label: "Judul", required: true, width: "half" },
      { kind: "text", name: "homeHeroAccent", label: "Kata aksen", width: "half" },
      { kind: "text", name: "homeHeroSuffix", label: "Kata akhiran", width: "half" },
      { kind: "textarea", name: "homeHeroText", label: "Deskripsi", rows: 3, width: "full" },
      { kind: "strings", name: "homeHeroDecos", label: "Dekorasi", width: "half" },
      {
        kind: "image",
        name: "homeHeroImage",
        label: "Latar belakang",
        empty: "null",
        width: "half",
        help: "Opsional. Menimpa foto paket favorit pertama sebagai foto latar hero beranda.",
      },
      {
        kind: "text",
        name: "homeHeroImageAlt",
        label: "Alt latar belakang",
        empty: "null",
        width: "half",
        help: "Deskripsi singkat foto latar. Relevan untuk pembaca layar dan SEO.",
      },
      { kind: "text", name: "homeHeroPrimaryLabel", label: "Tombol utama", width: "half" },
      {
        kind: "text",
        name: "homeHeroWaLink",
        label: "Link rotator tombol utama",
        width: "half",
        help: "Opsional. Link alternatif (mis. Bitly) yang menggantikan wa.me untuk tombol WhatsApp hero. Kosongkan untuk memakai nomor WhatsApp situs.",
      },
      {
        kind: "text",
        name: "waNumber",
        label: "Nomor WhatsApp",
        placeholder: "628133111543",
        width: "half",
        disabledWhen: "homeHeroWaLink",
        help: "Nomor WhatsApp seluruh situs. Kosong = nomor bawaan.",
      },
      {
        kind: "text",
        name: "waGreeting",
        label: "Sapaan pesan otomatis",
        width: "half",
        disabledWhen: "homeHeroWaLink",
        help: 'Ditempel di depan pesan WhatsApp, mis. "Halo". Kosong = tanpa sapaan.',
      },
      {
        kind: "textarea",
        name: "waMessage",
        label: "Pesan WhatsApp",
        rows: 2,
        width: "full",
        disabledWhen: "homeHeroWaLink",
        help: "Pesan default tombol WhatsApp situs, kecuali ditimpa di halaman kategori/paket.",
      },
      { kind: "text", name: "homeHeroSecondaryLabel", label: "Tombol sekunder", width: "half" },
      { kind: "text", name: "homeHeroSecondaryAnchor", label: "Anchor tombol sekunder", width: "half" },
      {
        kind: "repeater",
        name: "stats",
        label: "Baris statistik",
        width: "full",
        itemTitleField: "label",
        children: [
          { kind: "text", name: "num", label: "Angka", required: true, width: "third", placeholder: "500+" },
          { kind: "text", name: "label", label: "Keterangan", width: "two-thirds" },
        ],
      },
    ],
  },
  {
    id: "types",
    title: "Pilihan Tipe Trip",
    help: "Kartu tipe diambil dari setiap kategori. Isinya disunting di halaman tiap kategori.",
    fields: [
      sectionToggle("homeTypesEnabled"),
      { kind: "text", name: "homeTypesAnchor", label: "Anchor seksi", width: "half" },
      { kind: "text", name: "homeTypesTag", label: "Tag", width: "half" },
      { kind: "text", name: "homeTypesTitle", label: "Judul", width: "half" },
      { kind: "text", name: "homeTypesAccent", label: "Kata aksen", width: "half" },
      { kind: "text", name: "homeTypesSuffix", label: "Kata akhiran", width: "half" },
      { kind: "textarea", name: "homeTypesDesc", label: "Deskripsi", rows: 2, width: "full" },
    ],
  },
  {
    id: "pages",
    title: "Halaman Custom",
    help: "Kepala seksi kartu tautan. Kartunya sendiri diambil dari halaman yang ditandai tampil di beranda di menu Halaman Custom.",
    fields: [
      sectionToggle("homePgEnabled"),
      { kind: "text", name: "homePgAnchor", label: "Anchor seksi", width: "half" },
      { kind: "text", name: "homePgTag", label: "Tag", width: "half" },
      { kind: "text", name: "homePgTitle", label: "Judul", width: "half" },
      { kind: "text", name: "homePgAccent", label: "Kata aksen", width: "half" },
      { kind: "text", name: "homePgSuffix", label: "Kata akhiran", width: "half" },
      { kind: "textarea", name: "homePgDesc", label: "Deskripsi", rows: 2, width: "full" },
    ],
  },
  {
    id: "favorites",
    title: "Paket Favorit",
    help: "Paket yang tampil diambil dari tiap halaman paket: tandai “Tampilkan di beranda”.",
    fields: [
      sectionToggle("homeFavEnabled"),
      { kind: "text", name: "homeFavTag", label: "Tag", width: "half" },
      { kind: "text", name: "homeFavTitle", label: "Judul", width: "half" },
      { kind: "text", name: "homeFavAccent", label: "Kata aksen", width: "half" },
      { kind: "text", name: "homeFavSuffix", label: "Kata akhiran", width: "half" },
      { kind: "textarea", name: "homeFavDesc", label: "Deskripsi", rows: 2, width: "full" },
      {
        kind: "number",
        name: "homeGridColumns",
        label: "Kolom di desktop",
        width: "half",
        min: 1,
        max: 4,
      },
    ],
  },
  {
    id: "benefits",
    title: "Keunggulan",
    fields: [
      sectionToggle("homeBenefitsEnabled"),
      { kind: "text", name: "homeBenefitsTag", label: "Tag", width: "half" },
      { kind: "text", name: "homeBenefitsTitle", label: "Judul", width: "half" },
      { kind: "text", name: "homeBenefitsAccent", label: "Kata aksen", width: "half" },
      { kind: "text", name: "homeBenefitsSuffix", label: "Kata akhiran", width: "half" },
      { kind: "textarea", name: "homeBenefitsDesc", label: "Deskripsi", rows: 2, width: "full" },
      {
        kind: "repeater",
        name: "benefits",
        label: "Daftar keunggulan beranda",
        width: "full",
        itemTitleField: "title",
        help: "Hanya keunggulan beranda. Keunggulan tiap kategori disunting di halaman kategorinya.",
        children: [
          { kind: "text", name: "icon", label: "Ikon", width: "third", placeholder: "🏔" },
          { kind: "text", name: "title", label: "Judul", required: true, width: "two-thirds" },
          { kind: "textarea", name: "description", label: "Deskripsi", rows: 2, width: "full" },
        ],
      },
    ],
  },
  {
    id: "testimonials",
    title: "Testimoni",
    fields: [
      sectionToggle("homeTestiEnabled"),
      { kind: "text", name: "homeTestiTag", label: "Tag", width: "half" },
      { kind: "text", name: "homeTestiTitle", label: "Judul", width: "half" },
      { kind: "text", name: "homeTestiAccent", label: "Kata aksen", width: "half" },
      { kind: "text", name: "homeTestiSuffix", label: "Kata akhiran", width: "half" },
      { kind: "textarea", name: "homeTestiDesc", label: "Deskripsi", rows: 2, width: "full" },
      {
        kind: "repeater",
        name: "testimonials",
        label: "Testimoni",
        width: "full",
        itemTitleField: "author",
        children: [
          {
            kind: "number",
            name: "stars",
            label: "Bintang",
            width: "third",
            min: 0,
            max: 5,
          },
          { kind: "text", name: "quote", label: "Kutipan", required: true, width: "two-thirds" },
          { kind: "text", name: "author", label: "Nama", width: "half" },
          { kind: "text", name: "location", label: "Kota", width: "half" },
        ],
      },
    ],
  },
  {
    id: "instagram",
    title: "Feed Instagram",
    help: "Grid mengambil postingan terbaru dari Instagram lewat Meta Graph API dan menyimpannya otomatis — isi `IG_USER_ID` + `IG_ACCESS_TOKEN` di .env. Tanpa keduanya, kepala seksi dan baris brand tetap tampil, hanya grid dan tombolnya yang absen.",
    fields: [
      sectionToggle("homeIgEnabled"),
      { kind: "text", name: "homeIgTag", label: "Tag", width: "half" },
      { kind: "text", name: "homeIgTitle", label: "Judul", width: "half" },
      { kind: "text", name: "homeIgAccent", label: "Kata aksen", width: "half" },
      { kind: "text", name: "homeIgSuffix", label: "Kata akhiran", width: "half" },
      {
        kind: "textarea",
        name: "homeIgDesc",
        label: "Deskripsi di samping logo",
        rows: 3,
        width: "full",
        help: "Teks pada baris brand. Seluruh baris (logo + teks ini) tertaut ke profil Instagram; hover salah satunya menyalakan efek keduanya.",
      },
    ],
  },
  {
    id: "gallery",
    title: "Galeri Pengunjung",
    help: "Foto yang diunggah di sini tampil di seksi galeri beranda. Selama daftar masih kosong, kepala seksi tetap tampil tanpa grid foto.",
    fields: [
      sectionToggle("homeGalleryEnabled"),
      { kind: "text", name: "homeGalleryAnchor", label: "Anchor seksi", width: "half" },
      { kind: "text", name: "homeGalleryTag", label: "Tag", width: "half" },
      { kind: "text", name: "homeGalleryTitle", label: "Judul", width: "half" },
      { kind: "text", name: "homeGalleryAccent", label: "Kata aksen", width: "half" },
      { kind: "text", name: "homeGallerySuffix", label: "Kata akhiran", width: "half" },
      { kind: "textarea", name: "homeGalleryDesc", label: "Deskripsi", rows: 2, width: "full" },
      {
        kind: "number",
        name: "homeGalleryColumns",
        label: "Kolom di desktop",
        width: "half",
        min: 1,
        max: 4,
      },
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
    help: "Blok ajakan booking juga dipakai di semua halaman paket.",
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
        help: "Nomor tombol banner CTA di semua halaman. Kosong = nomor WhatsApp situs.",
      },
      {
        kind: "text",
        name: "ctaWaGreeting",
        label: "Sapaan pesan otomatis CTA",
        width: "half",
        disabledWhen: "ctaWaLink",
        help: 'Ditempel di depan pesan banner CTA. Kosong = sapaan situs.',
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
        help: "Opsional. Link alternatif (mis. Bitly) yang menggantikan wa.me untuk tombol banner CTA di semua halaman. Kosongkan untuk memakai nomor WhatsApp situs.",
      },
      {
        kind: "image",
        name: "ctaBackground",
        label: "Latar belakang gambar CTA",
        empty: "null",
        width: "half",
        help: "Opsional. Dipakai di banner CTA semua halaman; kosongkan untuk kembali ke gradasi hijau.",
      },
    ],
  },
];

/** Spec datar untuk `parseFields()` dan `buildValidator()`. */
export const homeFields: Field[] = flattenSections(homeSections);