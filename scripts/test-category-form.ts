/**
 * Test formulir admin generik terhadap model `Category`.
 *
 * Dua hal yang diuji, karena keduanya bisa rusak tanpa build apa-apa:
 *
 *   1. Halaman benar-benar merender form: tiap nama field di spec muncul
 *      sebagai input, dan repeater mengirim jumlah barisnya lewat `__count`.
 *      Ini menangkap spec yang melenceng dari prisma atau halaman yang lupa
 *      mengoper `initial`.
 *
 *   2. `parseFields()` + `buildValidator()` menghasilkan objek yang benar-benar
 *      diterima Prisma untuk `create` dan `update`, termasuk anak `benefits`.
 *      Ini menangkap masalah yang paling mahal: `NaN` untuk kolom `Int`,
 *      nilai di luar enum, atau kolom yang salah nama yang lolos validasi.
 *
 * Semua penulisan dibungkus transaksi yang selalu di-rollback, jadi data
 * produksi tidak tersentuh.
 */
import "dotenv/config";

import { SignJWT } from "jose";

import { categoryFields, emptyCategory } from "../src/lib/admin/category-fields";
import { parseFields } from "../src/lib/admin/fields";
import { buildValidator, errorMap } from "../src/lib/admin/validate";
import { prisma } from "../src/lib/db";
import type { Prisma } from "../src/generated/prisma/client";

const BASE = process.env.CATEGORY_TEST_BASE ?? "http://localhost:3000";

let pass = 0;
let fail = 0;

function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    pass++;
    console.log(`  ok   ${name}${detail ? ` - ${detail}` : ""}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}${detail ? ` - ${detail}` : ""}`);
  }
}

function eq(name: string, actual: unknown, expected: unknown) {
  const same = JSON.stringify(actual) === JSON.stringify(expected);
  check(name, same, same ? "" : `dapat ${JSON.stringify(actual)}, harap ${JSON.stringify(expected)}`);
}

const validator = buildValidator(categoryFields);

/**
 * Nama input yang harus ada di HTML untuk sebuah field.
 *
 * Repeater memakai indeks baris (`benefits.0.title`), jadi untuk repeater
 * yang sedang berisi data, hanya pola/common prefix yang bisa dicek di sini;
 * jumlah barisnya dicek terpisah lewat `__count`.
 */
function inputNames(fields: typeof categoryFields, prefix = ""): string[] {
  return fields.flatMap((field) => {
    const path = prefix ? `${prefix}.${field.name}` : field.name;
    if (field.kind === "repeater") {
      const indexed = `name="${path}.0.`;
      return [indexed, ...inputNames(field.children, `${path}.0`)];
    }
    return [`name="${path}"`];
  });
}

/** Teks yang sudah di-escape seperti yang dilakukan React saat merender. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Susun `FormData` seperti yang akan dikirim browser untuk sebuah record. */
function toFormData(record: Record<string, unknown>, id?: string): FormData {
  const form = new FormData();
  if (id) form.set("id", id);

  for (const field of categoryFields) {
    const value = record[field.name];

    if (field.kind === "repeater") {
      const items = (value ?? []) as Record<string, unknown>[];
      form.set(`${field.name}.__count`, String(items.length));
      items.forEach((item, index) => {
        for (const child of field.children) {
          const raw = item[child.name];
          if (child.kind === "boolean") {
            if (raw) form.set(`${field.name}.${index}.${child.name}`, "on");
          } else if (child.kind === "strings" || child.list) {
            form.set(`${field.name}.${index}.${child.name}`, (raw as string[]).join("\n"));
          } else {
            form.set(`${field.name}.${index}.${child.name}`, raw === null ? "" : String(raw));
          }
        }
      });
      continue;
    }

    if (field.kind === "boolean") {
      if (value) form.set(field.name, "on");
    } else if (field.kind === "strings" || field.list) {
      form.set(field.name, ((value ?? []) as string[]).join("\n"));
    } else {
      form.set(field.name, value === null || value === undefined ? "" : String(value));
    }
  }

  return form;
}

async function mintSession(userId: string, email: string, name: string): Promise<string> {
  const secret = new TextEncoder().encode(process.env.AUTH_SECRET ?? "");
  return new SignJWT({ email, name, role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secret);
}

/**
 * Jalankan penulisan lalu selalu batalkan.
 *
 * Prisma mengembalikan transaksi ke kondisi semula kalau callback melempar,
 * jadi ini cara menguji `create`/`update` sungguhan tanpa mengubah data.
 */
async function expectRollback<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<{
  error: unknown;
  wrote: boolean;
}> {
  let wrote = false;
  try {
    await prisma.$transaction(async (tx) => {
      await fn(tx);
      wrote = true;
      throw new Error("__rollback__");
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message !== "__rollback__") return { error, wrote };
  }
  return { error: null, wrote };
}

async function main() {
  const admin = await prisma.adminUser.findFirst({ orderBy: { createdAt: "asc" } });
  if (!admin) throw new Error("tidak ada AdminUser; jalankan `pnpm admin:create` lebih dulu");
  const token = await mintSession(admin.id, admin.email, admin.name);
  const auth = { cookie: `hb_admin_session=${token}` };

  const categories = await prisma.category.findMany({
    orderBy: { order: "asc" },
    include: { benefits: { orderBy: { order: "asc" } } },
  });
  if (categories.length === 0) throw new Error("tidak ada Category; jalankan `pnpm setup`");

  // Sengaja memilih kategori yang benar-benar punya keunggulan. Repeater tidak
  // merender baris apa pun kalau jumlahnya nol, jadi nama field `benefits.0.*`
  // tidak akan ada di HTML dan pemeriksaan "semua nama field ada" jadi tidak
  // menguji apa-apa (atau menyalahkan halaman yang sebenarnya benar).
  const sample =
    categories.find((category) => category.benefits.length > 0) ?? categories[0]!;
  console.log(`Menguji ${categories.length} kategori, contoh: ${sample.slug}\n`);

  console.log("1. Gerbang akses");
  {
    const anon = await fetch(`${BASE}/admin/kategori`, { redirect: "manual" });
    check("anonim dialihkan", anon.status === 307 || anon.status === 302, `status ${anon.status}`);
    check(
      "ke halaman login",
      anon.headers.get("location")?.includes("/admin/login") === true,
      anon.headers.get("location") ?? "(tanpa location)",
    );

    const ok = await fetch(`${BASE}/admin/kategori`, { headers: auth, redirect: "manual" });
    check("admin boleh", ok.status === 200, `status ${ok.status}`);
  }

  console.log("\n2. Halaman daftar merender data");
  {
    const html = await (await fetch(`${BASE}/admin/kategori`, { headers: auth })).text();
    for (const category of categories) {
      check(`"${category.name}" muncul`, html.includes(category.name));
    }
    check("tautan buat Kategori baru ada", html.includes("/admin/kategori/baru"));
  }

  console.log("\n3. Form edit merender semua field");
  {
    const html = await (
      await fetch(`${BASE}/admin/kategori/${sample.slug}`, { headers: auth })
    ).text();

    const missing = inputNames(categoryFields).filter((name) => !html.includes(name));
    check("semua nama field ada di HTML", missing.length === 0, missing.join(", "));

    check("id tersembunyi untuk mode ubah", html.includes(`name="id" value="${sample.id}"`));
    // Field teks kini textarea auto-grow, jadi nilai bisa muncul sebagai
    // `value="..."` (input) atau sebagai isi textarea (`>nilai<`).
    check(
      "slug terisi di input",
      html.includes(`value="${sample.slug}"`) ||
        html.includes(`>${escapeHtml(sample.slug)}<`),
    );

    // Repeater harus mengirim jumlah baris, bukan hope-and-pray.
    const count = html.match(/name="benefits\.__count" value="(\d+)"/);
    check(
      "__count sesuai jumlah keunggulan",
      count?.[1] === String(sample.benefits.length),
      `dapat ${count?.[1] ?? "tidak ada"}, harap ${sample.benefits.length}`,
    );

    for (const benefit of sample.benefits) {
      check(
        `keunggulan "${benefit.title}" ter-render`,
        html.includes(escapeHtml(benefit.title)),
        escapeHtml(benefit.title),
      );
    }

    // Kartu "pilihan tipe trip" di beranda tidak pernah muncul di halaman
    // kategori, jadi satu-satunya tempat menilainya adalah live view editor
    // kategori. Kalau blok ini hilang, enam field di section "Kartu di Beranda"
    // jadi tidak bisa dilihat hasilnya.
    check(
      "live view kartu beranda ada",
      html.includes('class="type-card"') && html.includes('class="type-grid"'),
    );
    check("kartu diikat ke section form", html.includes('data-section="card"'));
    if (sample.cardDescription) {
      check(
        "isi kartu ikut ter-render",
        html.includes(escapeHtml(sample.cardDescription)),
        escapeHtml(sample.cardDescription),
      );
    }
  }

  console.log("\n4. Halaman 'Kategori baru'");
  {
    const res = await fetch(`${BASE}/admin/kategori/baru`, { headers: auth, redirect: "manual" });
    check("halaman ada", res.status === 200, `status ${res.status}`);
    const html = await res.text();
    check("tidak mengirim id (mode buat)", !html.includes(`name="id" value=`));
    check("gridColumns default 3", html.includes('name="gridColumns"') && html.includes('value="3"'));
    check("live view ada di halaman buat", html.includes("live-editor") && html.includes("live-preview"));
    check("shell preview kategori ter-render", html.includes("hb2d1n"));
  }

  console.log("\n5. Round-trip: record -> FormData -> parse -> validasi");
  {
    const record: Record<string, unknown> = { ...emptyCategory(), ...sample };
    record.benefits = sample.benefits.map((b) => ({ ...b }));

    const parsed = parseFields(toFormData(record, sample.id), categoryFields);
    const result = validator.safeParse(parsed);

    if (!result.success) {
      console.log("    error:", JSON.stringify(errorMap(result.error), null, 2));
    }
    check("record asli lolos validasi", result.success);

    if (result.success) {
      const data = result.data as Record<string, unknown>;
      eq("slug tidak berubah", data.slug, sample.slug);
      eq("gridColumns utuh", data.gridColumns, sample.gridColumns);
      eq("jumlah keunggulan utuh", (data.benefits as unknown[]).length, sample.benefits.length);
      check(
        "tidak ada NaN yang lolos",
        !JSON.stringify(data, (_k, v) => (typeof v === "number" && Number.isNaN(v) ? "NaN!" : v)).includes("NaN!"),
      );
    }
  }

  console.log("\n6. Prisma menerima hasil parse (create)");
  {
    const record: Record<string, unknown> = {
      ...emptyCategory(),
      ...sample,
      name: "Kategori Uji Otomatis",
      slug: "uji-otomatis",
      heroBadges: [],
      heroDecos: [],
      benefits: [{ icon: "x", title: "Uji", description: "d", order: 0 }],
    };

    const result = validator.safeParse(parseFields(toFormData(record), categoryFields));
    check("lolos validasi", result.success);
    if (!result.success) console.log("    error:", JSON.stringify(errorMap(result.error)));

    if (result.success) {
      const { benefits, ...scalars } = result.data as Record<string, unknown>;
      const data = {
        ...(scalars as Omit<Prisma.CategoryCreateInput, "benefits" | "packages">),
        benefits: {
          create: (benefits as Record<string, unknown>[]).map((b, i) => ({
            icon: String(b.icon ?? ""),
            title: String(b.title ?? ""),
            description: String(b.description ?? ""),
            order: typeof b.order === "number" && !Number.isNaN(b.order) ? b.order : i,
            isHomepage: false,
          })),
        },
      } satisfies Prisma.CategoryCreateInput;

      const { error } = await expectRollback((tx) => tx.category.create({ data }));
      check("create diterima Prisma", error === null, describeError(error));
    }
  }

  console.log("\n7. Prisma menerima hasil parse (update, tulis ulang penuh)");
  {
    const record: Record<string, unknown> = {
      ...emptyCategory(),
      ...sample,
      // gridColumns dikosongkan supaya jalur `NaN` ikut teruji.
      gridColumns: null,
      benefits: sample.benefits.slice(0, 1).map((b) => ({ ...b, order: null })),
    };

    const result = validator.safeParse(parseFields(toFormData(record, sample.id), categoryFields));
    check("nama wajib kosong ditolak", !result.success);
    if (!result.success) {
      const map = errorMap(result.error);
      check("menyebut kolom gridColumns", "gridColumns" in map, JSON.stringify(Object.keys(map)));
    }

    // Sekarang versi valid dengan gridColumns terisi.
    record.gridColumns = 2;
    const ok = validator.safeParse(parseFields(toFormData(record, sample.id), categoryFields));
    check("versi terisi lolos", ok.success);

    if (ok.success) {
      const { benefits, ...scalars } = ok.data as Record<string, unknown>;
      const data = {
        ...(scalars as Omit<Prisma.CategoryCreateInput, "benefits" | "packages">),
        slug: sample.slug,
        benefits: {
          deleteMany: {},
          create: (benefits as Record<string, unknown>[]).map((b, i) => ({
            icon: String(b.icon ?? ""),
            title: String(b.title ?? ""),
            description: String(b.description ?? ""),
            order: typeof b.order === "number" && !Number.isNaN(b.order) ? b.order : i,
            isHomepage: false,
          })),
        },
      } satisfies Prisma.CategoryUpdateInput;

      const { error } = await expectRollback((tx) => tx.category.update({ where: { id: sample.id }, data }));
      check("update diterima Prisma", error === null, describeError(error));
    }
  }

  console.log("\n8. Slug unik dan enum");
  {
    // Slug yang sudah dipakai kategori lain harus ditolak sebelum menyentuh DB.
    const clash = categories[1];
    if (clash) {
      const record: Record<string, unknown> = { ...emptyCategory(), ...sample, slug: clash.slug };
      const result = validator.safeParse(parseFields(toFormData(record, sample.id), categoryFields));
      check("slug bentrok tetap lolos validator (dicek di action)", result.success);
    }

    const bad = { ...emptyCategory(), name: "X", kind: "TIDAK_ADA" };
    const result = validator.safeParse(parseFields(toFormData(bad), categoryFields));
    check("enum tak dikenal ditolak", !result.success);
  }

  console.log("\n9. Kartu beranda di live view semua kategori");
  {
    // Kategori Open Trip dan Private punya bentuk kartu berbeda di halaman
    // kategori, tapi kartu "pilihan tipe trip" di beranda sama persis untuk
    // keduanya. Jadi pratinjau wajib ada di setiap editor kategori, bukan cuma
    // di kategori pertama yang kebetulan jadi contoh.
    const tanpaKartu: string[] = [];

    for (const category of categories) {
      const html = await (
        await fetch(`${BASE}/admin/kategori/${category.slug}`, { headers: auth })
      ).text();
      const ada = html.includes('class="type-card"') && html.includes('data-section="card"');
      if (!ada) tanpaKartu.push(`${category.slug} (${category.kind})`);
    }

    check(
      "setiap kategori punya live view kartu",
      tanpaKartu.length === 0,
      tanpaKartu.length ? `hilang: ${tanpaKartu.join(", ")}` : `${categories.length} kategori`,
    );

    const openTrip = categories.filter((c) => c.kind === "OPEN_TRIP");
    const privateTrip = categories.filter((c) => c.kind === "PRIVATE");
    check("sampelnya menutup kedua jenis", openTrip.length > 0 && privateTrip.length > 0, `${openTrip.length} open trip, ${privateTrip.length} private`);
  }

  console.log(`\n${pass} lulus, ${fail} gagal`);
  await prisma.$disconnect();
  process.exit(fail ? 1 : 0);
}

function describeError(error: unknown): string {
  if (!error) return "";
  if (typeof error === "object" && error !== null && "code" in error) {
    return `kode ${String((error as { code: unknown }).code)}`;
  }
  return error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
