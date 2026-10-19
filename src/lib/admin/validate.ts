import { z } from "zod";

import type { Field } from "./fields";

/**
 * Validator yang dibangun dari spec field.
 *
 * Sengaja tidak memakai `import "server-only"`. Modul ini tidak menyentuh
 * secret apa pun, dan zod schema aman kalau keb ikut ke bundle client —
 * sementara guard itu akan membuat modul ini mustahil diuji di luar Next
 * (`server-only` melempar error di Node biasa, bukan hanya disembunyikan).
 *
 * Guard tetap dipasang di `src/lib/auth.ts` dan `src/lib/storage.ts` yang
 * benar-benar memegang kredensial.
 */
/**
 * URL gambar yang aman disimpan.
 *
 * Picker di client hanya menawarkan aset yang sudah terunggah, tapi daftar di UI
 * bukan penjagaan validasi — request bisa dibuat langsung tanpa melewati picker.
 * Tanpa\refine di sini, `cardImage` bisa diisi `javascript:alert(1)` atau piksel
 * pelacak dari luar, dan nilainya akan ikut ter-render di halaman publik.
 *
 * Yang diterima:
 *   - `https://…` / `http://…` — termasuk URL hasil impor lama yang masih
 *     menunjuk ke host WordPress, jadi konten existing tidak ikut rusak.
 *   - `/uploads/…` — path relatif dari driver storage lokal.
 *
 * Yang ditolak: `javascript:`, `data:`, `//host/path` (protocol-relative,
 * bisa dialihkan lewat http), dan path relatif di luar `/uploads/`.
 */
const SAFE_IMAGE_URL = /^(https?:\/\/|\/uploads\/)/i;

export function buildValidator(fields: Field[]) {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of fields) {
    if (field.kind === "repeater") {
      const itemSchema = buildValidator(field.children);
      shape[field.name] = z
        .array(z.record(z.string(), z.unknown()))
        .superRefine((items, ctx) => {
          // Validasi isi tiap item dilakukan terpisah agar pesan error menyebut
          // baris yang salah, bukan hanya "array tidak valid".
          items.forEach((item, index) => {
            const result = itemSchema.safeParse(item);
            if (!result.success) {
              for (const issue of result.error.issues) {
                ctx.addIssue({
                  code: "custom",
                  path: [index, ...issue.path],
                  message: `Baris ${index + 1}: ${issue.message}`,
                });
              }
            }
          });
        });
      continue;
    }

    if (field.kind === "matrix") {
      // Bentuknya sudah dipastikan `Record<string, string>` oleh `parseMatrix`;
      // validasi di sini hanya menjaga supaya spec lain tidak diam-diam
      // menerima bentuk yang salah.
      shape[field.name] = z.record(z.string(), z.string());
      continue;
    }

    if (field.kind === "boolean") {
      shape[field.name] = z.boolean();
      continue;
    }

    if (field.kind === "image" && field.multiple) {
      shape[field.name] = z.array(
        z
          .string()
          .regex(SAFE_IMAGE_URL, `${field.label} harus berupa URL http(s) atau path /uploads/.`),
      );
      continue;
    }

    if (field.kind === "strings" || field.kind === "selectMultiple" || field.list) {
      shape[field.name] = z.array(z.string());
      continue;
    }

    if (field.kind === "number") {
      // zod v4 mengganti `invalid_type_error` dengan `error`. Pesannya ditulis
      // eksplisit karena nilai dari `parseNumber()` bisa `NaN` (wajib diisi
      // tapi kosong) dan pesan bawaan zod untuk `NaN` kurang informatif.
      let schema = z.coerce.number({ error: `${field.label} harus berupa angka.` });
      if (field.min !== undefined) {
        schema = schema.min(field.min, `${field.label} minimal ${field.min}.`);
      }
      if (field.max !== undefined) {
        schema = schema.max(field.max, `${field.label} maksimal ${field.max}.`);
      }
      shape[field.name] = schema.nullable().optional();
      continue;
    }

    if (field.kind === "image") {
      // `required` dan "URL aman" dua aturan terpisah: kekosongan dicek lebih
      // dulu, baru formatnya.
      const required = field.required
        ? z.string().trim().min(1, `${field.label} wajib diisi.`)
        : z.string();
      shape[field.name] = required
        .refine(
          (v) => v === "" || SAFE_IMAGE_URL.test(v),
          `${field.label} harus berupa URL http(s) atau path /uploads/.`,
        )
        .nullable()
        .optional();
      continue;
    }

    let schema = z.string();
    if (field.required) {
      schema = schema.trim().min(1, `${field.label} wajib diisi.`);
    }
    shape[field.name] = schema.nullable().optional();
  }

  return z.object(shape);
}

export type FieldError = { path: string; message: string };

/**
 * Rakit daftar error dari hasil validasi.
 *
 * `path` memakai notasi yang sama dengan nama input (`itinerary.0.label`)
 * supaya client bisa menandai field yang tepat.
 */
export function collectErrors(
  error: z.ZodError,
): { errors: FieldError[]; first: string | null } {
  const errors = error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
  return { errors, first: errors[0]?.message ?? null };
}

/**
 * Bentuk yang dipakai `<AdminForm>`: path → pesan.
 *
 * Kalau satu field punya beberapa masalah (mis. kurang dari minimum dan
 * salah format), hanya pesan pertama yang dipakai supaya kolomnya tidak
 * menampilkan dua baris error sekaligus.
 */
export function errorMap(error: z.ZodError): Record<string, string> {
  const map: Record<string, string> = {};
  for (const { path, message } of collectErrors(error).errors) {
    if (!(path in map)) map[path] = message;
  }
  return map;
}
