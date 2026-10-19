import { SCHEDULE_OPTIONS } from "@/lib/bio";

import type { Field } from "./fields";
import { flattenSections, type FieldSection } from "./sections";

/**
 * Spec form halaman link-bio (`/adm-cms-hb/sosmed`).
 *
 * Sebelumnya editor ini hanya satu textarea HTML: dokumen link-bio utuh
 * ditempel, lalu `/bio/<slug>` mengirimkannya apa adanya. Sekarang halaman
 * dirender komponen native `<BioLinkPage>` dari data terstruktur, jadi tiap
 * bagian halaman punya field sendiri.
 *
 * Kontrak penting: **nama field di sini sama persis dengan kunci
 * `BioLinkPageData` di `@/lib/bio`**. `saveSosmedAction` memisahkan kolom meta
 * (`title`, `slug`, `order`, `isPublished`) dari sisanya, lalu sisanya disimpan
 * utuh ke kolom JSON `HtmlPage.bio` — tanpa lapisan penerjemah nama.
 *
 * `id` section dipakai live preview untuk memetakan klik bagian halaman ke
 * group field, sama seperti editor kategori/paket.
 */
export function sosmedSections(): FieldSection[] {
  return [
    {
      id: "meta",
      title: "Informasi",
      help: "Judul, alamat, urutan, dan status tayang.",
      fields: [
        { kind: "text", name: "title", label: "Judul halaman", required: true, width: "half" },
        {
          kind: "text",
          name: "slug",
          label: "Slug",
          help: "Dipakai untuk alamat /bio/<slug>. Huruf kecil, angka, dan tanda hubung; kosongkan untuk menurunkannya dari judul.",
          placeholder: "instagram-link-bio",
          width: "half",
        },
        { kind: "number", name: "order", label: "Urutan tampil", min: 0, width: "third" },
        {
          kind: "boolean",
          name: "isPublished",
          label: "Tayang",
          help: "Tanpa centang, /bio/<slug> menampilkan 404.",
          width: "third",
        },
      ],
    },
    {
      id: "hero",
      title: "Hero",
      help: "Logo, nama brand, kalimat pembuka, dan tombol WhatsApp.",
      fields: [
        {
          kind: "text",
          name: "brand",
          label: "Nama brand",
          width: "half",
        },
        {
          kind: "text",
          name: "tag",
          label: "Tagline kecil",
          placeholder: "Explore More Banyuwangi",
          width: "half",
        },
        {
          kind: "textarea",
          name: "subtitle",
          label: "Subjudul",
          rows: 2,
          width: "full",
          help: "Baris baru dipertahankan seperti di halaman.",
        },
        {
          kind: "image",
          name: "logo",
          label: "Logo",
          width: "half",
        },
        {
          kind: "text",
          name: "logoAlt",
          label: "Teks alternatif logo",
          width: "half",
        },
        { kind: "strings", name: "chips", label: "Chips / jaminan", width: "full" },
        {
          kind: "text",
          name: "waNumber",
          label: "Nomor WhatsApp",
          placeholder: "628133111543",
          width: "half",
        },
        {
          kind: "text",
          name: "waLink",
          label: "Link rotator tombol WhatsApp",
          help: "Opsional. Link alternatif (mis. Bitly) yang menggantikan wa.me untuk tombol WhatsApp di hero. Kosongkan untuk memakai nomor WhatsApp.",
          width: "half",
        },
        {
          kind: "text",
          name: "waGreeting",
          label: "Sapaan pesan otomatis",
          help: "Dipakai di awal pesan Open Trip dan Private Trip.",
          placeholder: "Halo",
          width: "half",
        },
        { kind: "text", name: "waLabel", label: "Teks tombol WhatsApp", width: "full" },
        { kind: "text", name: "waHint", label: "Catatan kecil bawah tombol", width: "half" },
        {
          kind: "textarea",
          name: "waMessageTop",
          label: "Pesan WhatsApp tombol atas",
          rows: 2,
          width: "full",
        },
      ],
    },
    {
      id: "openTrip",
      title: "Open Trip",
      help: "Daftar trip gabung rombongan dengan harga per orang.",
      fields: [
        { kind: "text", name: "openTripLabel", label: "Judul bagian", width: "full" },
        {
          kind: "repeater",
          name: "openTrips",
          label: "Daftar Open Trip",
          itemTitleField: "name",
          children: [
            { kind: "text", name: "name", label: "Nama trip", width: "half" },
            {
              kind: "select",
              name: "schedule",
              label: "Jadwal",
              options: SCHEDULE_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
              })),
              width: "third",
            },
            { kind: "number", name: "price", label: "Harga per pax", min: 0, width: "third" },
          ],
        },
        { kind: "textarea", name: "openTripNote", label: "Catatan bawah daftar", rows: 2, width: "full" },
      ],
    },
    {
      id: "privateTrip",
      title: "Private Trip",
      help: "Paket private: itinerary, tabel harga, dan fasilitas.",
      fields: [
        { kind: "text", name: "privateTripLabel", label: "Judul bagian", width: "full" },
        {
          kind: "repeater",
          name: "packages",
          label: "Daftar paket private",
          itemTitleField: "name",
          children: [
            { kind: "text", name: "name", label: "Nama paket", width: "half" },
            { kind: "text", name: "emoji", label: "Emoji ikon", width: "third" },
            {
              kind: "image",
              name: "image",
              label: "Ikon gambar (opsional)",
              help: "Kalau diisi, menggantikan emoji di kartu.",
              width: "third",
            },
            { kind: "text", name: "badge", label: "Badge (opsional)", width: "third" },
            {
              kind: "boolean",
              name: "badgeAlt",
              label: "Badge hijau (tanpa centang: oranye)",
              width: "half",
            },
            { kind: "textarea", name: "desc", label: "Deskripsi singkat", rows: 2, width: "full" },
            { kind: "strings", name: "meta", label: "Metadata chips (satu per baris)", width: "full" },
            {
              kind: "repeater",
              name: "itinerary",
              label: "Itinerary",
              itemTitleField: "day",
              children: [
                {
                  kind: "text",
                  name: "day",
                  label: "Judul hari (opsional)",
                  placeholder: "Hari 1 — Green Island",
                  width: "full",
                },
                {
                  kind: "repeater",
                  name: "steps",
                  label: "Langkah",
                  itemTitleField: "text",
                  children: [
                    { kind: "text", name: "time", label: "Jam", width: "third" },
                    { kind: "text", name: "text", label: "Kegiatan", width: "two-thirds" },
                  ],
                },
              ],
            },
            {
              kind: "repeater",
              name: "priceColumns",
              label: "Kolom tabel harga",
              itemTitleField: "label",
              keyField: "key",
              children: [
                { kind: "text", name: "label", label: "Judul kolom", width: "two-thirds" },
                {
                  kind: "text",
                  name: "key",
                  label: "Kunci",
                  help: "Penanda unik kolom; diisi otomatis.",
                  width: "third",
                },
              ],
            },
            {
              kind: "repeater",
              name: "prices",
              label: "Baris harga",
              itemTitleField: "pax",
              children: [
                { kind: "number", name: "pax", label: "Jumlah peserta", min: 1, width: "third" },
                {
                  kind: "matrix",
                  name: "values",
                  label: "Harga per kolom",
                  columnsField: "priceColumns",
                  columnIdField: "key",
                  columnLabelField: "label",
                },
              ],
            },
            { kind: "strings", name: "includes", label: "Sudah termasuk", width: "full" },
            { kind: "strings", name: "excludes", label: "Belum termasuk", width: "full" },
            {
              kind: "textarea",
              name: "note",
              label: "Catatan tambahan paket",
              rows: 2,
              width: "full",
            },
          ],
        },
      ],
    },
    {
      id: "gallery",
      title: "Galeri",
      help: "Grid foto momen.",
      fields: [
        { kind: "text", name: "galleryLabel", label: "Judul bagian", width: "full" },
        {
          kind: "repeater",
          name: "gallery",
          label: "Foto galeri",
          itemTitleField: "alt",
          children: [
            { kind: "image", name: "url", label: "Foto", width: "full" },
            { kind: "text", name: "alt", label: "Teks alternatif", width: "full" },
          ],
        },
      ],
    },
    {
      id: "cta",
      title: "Ajakan (CTA)",
      help: "Kotak ajakan itinerary custom di bawah galeri.",
      fields: [
        { kind: "text", name: "ctaTitle", label: "Judul", width: "full" },
        { kind: "textarea", name: "ctaText", label: "Teks", rows: 2, width: "full" },
        { kind: "text", name: "ctaLabel", label: "Teks tombol", width: "half" },
        { kind: "textarea", name: "ctaMessage", label: "Pesan WhatsApp tombol", rows: 2, width: "full" },
      ],
    },
    {
      id: "footer",
      title: "Footer",
      help: "Penutup halaman.",
      fields: [
        {
          kind: "textarea",
          name: "footerText",
          label: "Teks penutup",
          rows: 2,
          width: "full",
          help: "Baris baru dipertahankan seperti di halaman.",
        },
        { kind: "text", name: "footerLegal", label: "Nama legal / organisasi", width: "full" },
      ],
    },
  ];
}

/** Spec datar untuk `parseFields()` dan `buildValidator()`. */
export const sosmedFields: Field[] = flattenSections(sosmedSections());

/**
 * Nama field yang disimpan sebagai kolom `HtmlPage`, bukan ke dalam JSON `bio`.
 *
 * `saveSosmedAction` memakai daftar ini untuk memisahkan meta dari isi bio.
 */
export const SOSMED_META_FIELDS = ["title", "slug", "order", "isPublished"] as const;
