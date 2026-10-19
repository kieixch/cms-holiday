import type { Field } from "./fields";

/**
 * Group field untuk editor bernomor.
 *
 * Spec `Field[]` biasa tidak punya konsep "bagian halaman". Padahal editor
 * split butuh dua hal darinya:
 *
 *   1. Field di-group jadi accordion bernomor supaya form panjang tetap
 *      bisa dipindai.
 *   2. Setiap section punya `id` yang sama dengan penanda `data-section` di
 *      live preview, sehingga klik satu bagian halaman bisa membuka group
 *      field yang mengaturnya.
 *
 * Karena itu `id` di sini bukan bebas: nilainya harus sama dengan yang
 * dipakai `wrap()` di `@/components/site/views`.
 */
export type FieldSection = {
  /** Sama dengan section di `views.tsx`, mis. `hero`, `pricing`, `cta`. */
  id: string;
  /** Judul yang tampil di accordion, mis. "Hero". */
  title: string;
  help?: string;
  fields: Field[];
};

/** Spec datar untuk `parseFields()` dan `buildValidator()`. */
export function flattenSections(sections: FieldSection[]): Field[] {
  return sections.flatMap((section) => section.fields);
}

/**
 * Cari section yang punya sebuah field.
 *
 * Dipakai live preview untuk memetakan klik pada section halaman ke group
 * editor. Field `null` berarti field itu tidak dirender di halaman — misalnya
 * `isPublished` — jadi tidak ada section yang cocok dan klik diabaikan.
 */
export function sectionOfField(sections: FieldSection[], name: string): FieldSection | null {
  return sections.find((section) => section.fields.some((f) => f.name === name)) ?? null;
}

/** Nama section yang punya isi preview, urut seperti di spec. */
export function previewSections(sections: FieldSection[]): string[] {
  return sections.map((section) => section.id);
}