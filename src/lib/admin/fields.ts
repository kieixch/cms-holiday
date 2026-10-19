/**
 * Definisi field form admin — dipakai oleh server DAN client.
 *
 * Ide utamanya: satu spec mendeskripsikan sebuah field, lalu spec itu yang
 * menggerakkan dua hal sekaligus:
 *
 *   1. `parseFields()` di server mengubah `FormData` jadi objek siap Prisma.
 *   2. `<AdminForm>` di client merender kontrolnya.
 *
 * Kalau parsing ditulis terpisah dari markup, setiap penambahan field berarti
 * mengubah tiga tempat (markup, parser, validator) dan salah satu akan
 * terlewat. Dengan spec tunggal, menambah field cukup satu baris.
 *
 * Modul ini murni: tidak ada Prisma, React, atau `server-only`, jadi bisa
 * dipakai di kedua sisi dan diuji tanpa server.
 */

export type FieldWidth = "full" | "half" | "third" | "two-thirds";

type FieldBase = {
  /** Nama kolom di Prisma; juga menjadi `name` pada input. */
  name: string;
  label: string;
  help?: string;
  placeholder?: string;
  required?: boolean;
  width?: FieldWidth;
  /**
   * Apa yang ditulis ke database saat input dikosongkan.
   *
   * `"empty"` → `""`, aman untuk kolom `String` non-nullable.
   * `"null"`  → `null`, untuk kolom `String?`.
   *
   * Default `"empty"` karena jauh lebih banyak kolom non-nullable di schema,
   * dan `null` ke kolom non-nullable akan bikin Prisma error.
   */
  empty?: "empty" | "null";
  /** Kolom `String[]`. */
  list?: boolean;
  /**
   * Nama field lain di level yang sama. Kalau field itu berisi (bukan string
   * kosong), field ini dirender non-aktif (`disabled`).
   *
   * Dipakai untuk field yang jadi tidak relevan begitu field lain diisi —
   * mis. nomor/pesan WhatsApp tombol hero yang tak terpakai lagi saat link
   * rotator tombol itu diisi.
   */
  disabledWhen?: string;
};

export type ChildField = FieldBase &
  (
    | { kind: "text"; type?: "text" | "email" | "url" | "date" }
    | { kind: "textarea"; rows?: number }
    /**
     * Editor kode (dokumen HTML utuh). Dirender sebagai textarea monospace
     * berbaris banyak; parsing-nya sama dengan `textarea` — teks apa adanya,
     * tanpa dipotong di awal/akhir selain spasi yang memang tidak berarti.
     */
    | { kind: "code"; rows?: number }
    | { kind: "number"; min?: number; max?: number }
    | { kind: "boolean" }
    | { kind: "select"; options: Option[] }
    /**
     * Dropdown pilihan ganda. Nilai disimpan sebagai `string[]` (satu entri
     * per opsi terpilih), dipakai mis. untuk memilih beberapa kategori
     * penempatan kartu sekaligus.
     */
    | { kind: "selectMultiple"; options: Option[] }
    | { kind: "strings" }
    | { kind: "image"; multiple?: false }
    | { kind: "image"; multiple: true }
  );

export type Field = ChildField | RepeaterField | MatrixField;

export type RepeaterField = FieldBase & {
  kind: "repeater";
  /** Field anak; boleh `repeater` lagi untuk relasi bersarang. */
  children: Field[];
  /**
   * Nama field anak yang dipakai sebagai judul baris di daftar.
   *
   * Harus berupa nama, bukan fungsi: spec `Field[]` dikirim dari Server
   * Component ke Client Component, dan fungsi tidak bisa melewati batas itu —
   * Next akan menolak dengan "Functions cannot be passed directly to Client
   * Components". Kalau kosong, dipakai field teks pertama.
   */
  itemTitleField?: string;
  /**
   * Nama child yang diisi id acak otomatis tiap kali baris baru dibuat.
   *
   * Dipakai repeater kolom tabel harga: nilai sel matriks dikunci ke id kolom,
   * dan id itu harus tetap sama antara render client dan isi `FormData`.
   * Id asli dari database tidak pernah dipakai untuk ini, karena baris kolom
   * selalu dibuat ulang saat disimpan — cukup id yang unik per sesi edit.
   */
  keyField?: string;
};

/**
 * Satu input untuk tiap kolom tabel harga.
 *
 * Bentuk tabel harga paket bukan field biasa: daftar kolom dan daftar baris
 * saling merujuk lewat `PriceValue(rowId + columnId)`. Field ini menyimpan
 * nilainya sebagai objek `{ [columnId]: teks }`, jadi menambah atau menghapus
 * kolom tidak perlu mengubah struktur field-nya.
 *
 * Nomor kolom dibaca dari field lain pada level yang sama —
 * `columnsField` + `columnIdField`. Keduanya sengaja berupa nama, bukan
 * data, supaya spec tetap bisa dikirim ke Client Component.
 */
export type MatrixField = FieldBase & {
  kind: "matrix";
  /** Nama field repeater yang memuat daftar kolom. */
  columnsField: string;
  /** Nama child pada `columnsField` yang menyimpan identitas kolom. */
  columnIdField: string;
  /** Nama child pada `columnsField` yang dipakai sebagai judul kolom. */
  columnLabelField: string;
};

export type Option = { value: string; label: string };

export type Parsed = Record<string, unknown>;

const WIDTH_CLASS: Record<FieldWidth, string> = {
  full: "admin-span-full",
  half: "admin-span-half",
  third: "admin-span-third",
  "two-thirds": "admin-span-two-thirds",
};

export function widthClass(field: { width?: FieldWidth }): string {
  return WIDTH_CLASS[field.width ?? "half"];
}

/* ------------------------------------------------------------------ */
/* Parsing FormData                                                    */
/* ------------------------------------------------------------------ */

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

/**
 * Ubah `FormData` menjadi objek yang bisa langsung diteruskan ke Prisma.
 *
 * `prefix` dipakai repeater: anak item ke-3 punya nama `itinerary.2.label`.
 */
function parseInto(form: FormData, fields: Field[], prefix: string, out: Parsed): void {
  for (const field of fields) {
    const key = prefix ? `${prefix}.${field.name}` : field.name;

    if (field.kind === "repeater") {
      out[field.name] = parseRepeater(form, field, key);
      continue;
    }

    if (field.kind === "matrix") {
      out[field.name] = parseMatrix(form, key);
      continue;
    }

    if (field.kind === "boolean") {
      // Checkbox tidak mengirim nilai kalau tidak dicentang, jadi cukup
      // periksa keberadaannya. `form.has` bukan `=== "on"` karena nilai
      // custom tetap harus dianggap benar.
      out[field.name] = form.has(key);
      continue;
    }

    if (field.kind === "selectMultiple") {
      // `<select multiple>` mengirim satu entri FormData per opsi terpilih,
      // jadi `get()` (yang hanya mengambil yang pertama) tidak cukup.
      out[field.name] = form
        .getAll(key)
        .map((value) => (typeof value === "string" ? value : ""))
        .filter((value) => value !== "");
      continue;
    }

    if (field.kind === "number") {
      out[field.name] = parseNumber(text(form, key), field);
      continue;
    }

    if (field.kind === "image") {
      // Tunggal -> string biasa (kolom `String?`), banyak -> array (kolom
      // `String[]`). Keduanya diserialisasi per baris supaya bentuk textarea
      // readonly di client sama dengan `kind: "strings"`.
      out[field.name] = field.multiple
        ? parseStrings(text(form, key))
        : parseStringField(text(form, key), field);
      continue;
    }

    if (field.kind === "strings" || field.list) {
      out[field.name] = parseStrings(text(form, key));
      continue;
    }

    out[field.name] = parseStringField(text(form, key), field);
  }
}

function parseStringField(raw: string, field: FieldBase): string | null {
  const trimmed = raw.trim();

  if (trimmed === "") {
    if (field.required) return "";
    return field.empty === "null" ? null : "";
  }
  return raw;
}

/**
 * Angka kosong jadi `null` kalau opsional, dan `NaN` kalau wajib diisi.
 *
 * `NaN` sengaja dipakai sebagai penanda "wajib diisi tapi kosong": ia membuat
 * zod menolak dengan pesan yang jelas, dan `isEmptyItem` memperlakukannya
 * sebagai kosong supaya baris repeater yang belum diisi tidak ikut terkirim.
 * Kalau angka kosong jadi `""`, Prisma akan menerima string untuk kolom
 * Int dan errornya jauh lebih membingungkan.
 */
function parseNumber(
  raw: string,
  field: { min?: number; max?: number; required?: boolean; empty?: "empty" | "null" },
): number | null {
  const trimmed = raw.trim();

  if (trimmed === "") {
    return field.required ? Number.NaN : null;
  }

  const value = Number(trimmed);
  if (!Number.isFinite(value)) return Number.NaN;
  if (field.min !== undefined && value < field.min) return Number.NaN;
  if (field.max !== undefined && value > field.max) return Number.NaN;
  return value;
}

/**
 * `String[]` diserialisasi sebagai satu nilai per baris di textarea.
 * Dipilih daripada JSON supaya forms tetap bisa dikirim tanpa JavaScript.
 *
 * Field gambar (`kind: "image"`, `multiple: true`) memakai serialisasi yang
 * sama persis: satu URL per baris. Controls di client menuliskannya lewat
 * textarea readonly, jadi tanpa JavaScript form tetap berisi URL yang valid
 * walau picker-nya tidak bisa dipakai.
 */
function parseStrings(raw: string): string[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseRepeater(form: FormData, field: RepeaterField, prefix: string): Parsed[] {
  const items: Parsed[] = [];

  // Jumlah item ditentukan repeater client lewat field tersembunyi
  // `<prefix>.__count`, jadi server tidak perlu menebak dari form yang tidak
  // lengkap (item terakhir yang dihapus tidak punya input sama sekali).
  const countRaw = text(form, `${prefix}.__count`);
  const count = Math.min(Number.parseInt(countRaw, 10) || 0, 200);

  for (let i = 0; i < count; i++) {
    const item: Parsed = {};
    parseInto(form, field.children, `${prefix}.${i}`, item);

    // Item yang seluruh isinya kosong dibuang, supaya mengosongkan repeater
    // dan menghapusnya lewat tombol "hapus" punya hasil yang sama.
    if (isEmptyItem(item)) continue;
    items.push(item);
  }

  return items;
}

function isEmptyItem(item: Parsed): boolean {
  return Object.values(item).every((value) => {
    if (value === null || value === undefined) return true;
    // `NaN` = kolom wajib yang belum diisi. Diperlakukan sebagai kosong supaya
    // baris yang belum disentuh tidak ikut dikirim ke Prisma.
    if (typeof value === "number") return Number.isNaN(value);
    if (typeof value === "string") return value.trim() === "";
    if (Array.isArray(value)) return value.length === 0;
    // Baris tabel harga menyimpan objek nilai; kosong berarti tidak ada nilai.
    if (isPlainObject(value)) return Object.values(value).every((v) => String(v).trim() === "");
    // `false` adalah nilai sah untuk boolean, jadi bukan berarti kosong.
    if (typeof value === "boolean") return false;
    return false;
  });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Kumpulkan input matriks `prefix.<columnId>` jadi objek.
 *
 * Jumlah kolom tidak diketahui server — bergantung pada repeater kolom yang
 * dispensai bersama baris lain — jadi semua key yang diawali `prefix.` diambil
 * apa adanya. Key yang kosong diabaikan supaya kolom yang belum diisi tidak
 * berakhir sebagai `PriceValue` kosong.
 */
function parseMatrix(form: FormData, prefix: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, raw] of form.entries()) {
    if (!name.startsWith(`${prefix}.`)) continue;
    const columnId = name.slice(prefix.length + 1);
    if (!columnId || typeof raw !== "string") continue;
    const value = raw.trim();
    if (value !== "") out[columnId] = value;
  }
  return out;
}

export function parseFields(form: FormData, fields: Field[]): Parsed {
  const out: Parsed = {};
  parseInto(form, fields, "", out);
  return out;
}
