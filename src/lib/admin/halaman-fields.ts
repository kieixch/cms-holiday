import type { Field, Option } from "./fields";
import { flattenSections, type FieldSection } from "./sections";

/**
 * Spec form halaman HTML mandiri (`/admin/halaman`).
 *
 * Editor memakai `<LiveEditor>`: pratinjau di kolom kanan menampilkan dua
 * bagian yang bisa diklik untuk melompat ke field-nya — dokumen (iframe
 * `data:` yang me-render isi textarea apa adanya) dan kartu tautan (grid kartu
 * di konteks beranda sungguhan). Karena itu spec disusun sebagai `sections`;
 * `halamanFields` tetap diekspor datar untuk `parseFields()`/validator.
 *
 * Field `code` (kind baru) adalah textarea monospace untuk menempel dokumen
 * HTML utuh; parsingnya sama dengan textarea — teks apa adanya.
 *
 * `categories` diisi opsi kategori untuk dropdown penempatan kartu. Spec datar
 * `halamanFields` dibangun dengan daftar kosong: opsi hanya berpengaruh di
 * markup, bukan di parsing/validasi, jadi action server tetap bisa memakainya
 * tanpa query kategori.
 */
export function halamanSections(categories: Option[]): FieldSection[] {
  return [
    {
      id: "doc",
      title: "Dokumen HTML",
      help: "Tempel dokumen utuh; pratinjau di kanan merender isinya langsung.",
      fields: [
        {
          kind: "code",
          name: "html",
          label: "Dokumen HTML",
          required: true,
          rows: 20,
          width: "full",
          help: "Tempel dokumen HTML utuh (<html>…</html>) atau fragmen. Dirender apa adanya di /halaman/<slug>, di luar layout situs.",
          placeholder:
            "<!doctype html>\n<html>\n  <head><title>Judul</title></head>\n  <body>…</body>\n</html>",
        },
      ],
    },
    {
      id: "card",
      title: "Kartu tautan",
      help: "Kartu yang mengarah ke halaman ini di beranda / halaman kategori.",
      fields: [
        {
          kind: "boolean",
          name: "showOnHome",
          label: "Tampilkan kartu di beranda",
          width: "half",
        },
        {
          kind: "selectMultiple",
          name: "categorySlugs",
          label: "Tampilkan kartu di kategori",
          options: categories,
          help: "Klik untuk membuka daftar, lalu centang satu atau beberapa kategori. Kosong = kartu tidak tampil di kategori mana pun.",
          width: "half",
        },
        {
          kind: "image",
          name: "cardImage",
          label: "Gambar kartu",
          help: "Opsional. Tanpa gambar, kartu tampil sebagai blok teks.",
          width: "half",
        },
        {
          kind: "text",
          name: "cardTag",
          label: "Tag kartu",
          help: "Label kecil di atas judul. Kosong = tanpa tag.",
          width: "half",
        },
        {
          kind: "text",
          name: "cardTitle",
          label: "Judul kartu",
          help: "Kosong = judul halaman.",
          width: "half",
        },
        {
          kind: "textarea",
          name: "cardDesc",
          label: "Deskripsi kartu",
          rows: 3,
          width: "half",
        },
        {
          kind: "text",
          name: "cardButtonLabel",
          label: "Label tombol",
          help: "Kosong = tanpa tombol. Tujuan tombol tetap /halaman/<slug>.",
          width: "half",
        },
      ],
    },
    {
      id: "meta",
      title: "Informasi",
      help: "Judul, alamat, urutan, dan status tayang.",
      fields: [
        {
          kind: "text",
          name: "title",
          label: "Judul halaman",
          required: true,
          width: "half",
        },
        {
          kind: "text",
          name: "slug",
          label: "Slug",
          help: "Dipakai untuk alamat /halaman/<slug>. Huruf kecil, angka, dan tanda hubung; kosongkan untuk menurunkannya dari judul.",
          placeholder: "syarat-pemesanan",
          width: "half",
        },
        {
          kind: "number",
          name: "order",
          label: "Urutan tampil",
          min: 0,
          width: "third",
        },
        {
          kind: "boolean",
          name: "isPublished",
          label: "Tayang",
          help: "Tanpa centang, /halaman/<slug> menampilkan 404 dan kartu tidak tampil.",
          width: "third",
        },
      ],
    },
  ];
}

/** Spec datar untuk `parseFields()` dan `buildValidator()`. */
export const halamanFields: Field[] = flattenSections(halamanSections([]));
