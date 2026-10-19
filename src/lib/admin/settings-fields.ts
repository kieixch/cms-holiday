import type { Field } from "./fields";
import { flattenSections, type FieldSection } from "./sections";

/**
 * Spec form untuk halaman Pengaturan.
 *
 * Halaman ini menampung kolom `SiteSettings` yang bukan isi halaman mana pun:
 * mulai dari label dan link tombol WhatsApp melayang yang tampil di seluruh
 * situs. Editor Beranda sengaja tidak memuat field di sini supaya pengaturan
 * global tidak tertukar dengan isi beranda.
 */
export const settingsSections: FieldSection[] = [
  {
    id: "whatsapp",
    title: "Tombol WhatsApp",
    help: "Berlaku di seluruh situs. Kategori dan paket bisa menimpa nomor, sapaan, dan pesan di halaman masing-masing.",
    fields: [
      {
        kind: "text",
        name: "waNumber",
        label: "Nomor WhatsApp",
        placeholder: "628133111543",
        width: "half",
        help: "Nomor tujuan tombol WhatsApp situs. Kosong = nomor bawaan.",
      },
      {
        kind: "text",
        name: "waGreeting",
        label: "Sapaan pesan otomatis",
        width: "half",
        help: 'Ditempel di depan pesan WhatsApp, mis. "Halo". Kosong = tanpa sapaan.',
      },
      {
        kind: "textarea",
        name: "waMessage",
        label: "Pesan WhatsApp otomatis",
        rows: 2,
        width: "full",
        help: "Pesan default saat pengunjung menekan tombol WhatsApp, kecuali ditimpa di halaman kategori/paket.",
      },
    ],
  },
  {
    id: "sticky-wa",
    title: "Tombol WhatsApp Melayang",
    help: "Tombol yang selalu tampil di setiap halaman publik. Link rotator di sini hanya menggantikan tujuan tombol melayang.",
    fields: [
      { kind: "text", name: "stickyWaLabel", label: "Label tombol melayang", width: "half" },
      {
        kind: "text",
        name: "stickyWaLink",
        label: "Link rotator tombol melayang",
        width: "half",
        help: "Opsional. Link alternatif (mis. Bitly) yang menggantikan wa.me. Kosongkan untuk memakai nomor WhatsApp situs.",
      },
    ],
  },
];


/** Spec datar untuk `parseFields()` dan `buildValidator()`. */
export const settingsFields: Field[] = flattenSections(settingsSections);
