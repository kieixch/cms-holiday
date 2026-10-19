/**
 * Smoke test halaman admin paket dan beranda.
 *
 * Berbeda dari `test-category-form.ts` yang menguji parsing + markup form,
 * yang diuji di sini adalah tiga hal yang paling mudah salah dan paling mahal
 * kalau kelewat:
 *
 *   1. **Semua paket harus bisa disunting, termasuk yang tidak punya halaman
 *      detail.** 13 Open Trip hasil impor punya `hasDetailPage: false`. Kalau
 *      daftar paket memfilter kolom itu, management baru ini justru tidak bisa
 *      dipakai untuk paket yang paling butuh disunting.
 *
 *   2. **Nilai matriks harga harus dipasang ke kolom yang benar.** Sel dikirim
 *      sebagai `pricingRows.N.values.<columnId>`, dan `columnId` itu id
 *      `PriceColumn` asli. Kalau pemetaannya salah saat membuka editor, tabel
 *      terlihat benar di preview tapi nilainya tersimpan ke kolom lain.
 *
 *   3. **Accordion tidak boleh menyembunyikan nilai.** Section yang tertutup
 *      tetap harus ada di DOM. Kalau di-unmount, field-nya tidak ikut
 *      `FormData` — jadi menutup satu section berarti menghapus isinya saat
 *      disimpan, tanpa pesan error apa pun ke user.
 *
 * Ditambah sinkronisasi allowlist kolom di `package-scalars.ts` dengan spec di
 * `package-fields.ts`, supaya ketidakcocokan ketahuan di sini, bukan sebagai
 * "Unknown argument" Prisma di production.
 *
 * Semua penulisan dibungkus transaksi yang selalu di-rollback.
 */
import "dotenv/config";

import { renderToString } from "react-dom/server";
import { SignJWT } from "jose";

import { prisma } from "../src/lib/db";
import { Hero, resolveSecondaryAnchor, type HeroProps } from "../src/components/site/hero";
import { parseFields } from "../src/lib/admin/fields";
import { homeFields } from "../src/lib/admin/home-fields";
import { packageFields } from "../src/lib/admin/package-fields";
import {
  DETAIL_CARD_BUTTON,
  syncDetailLinks,
  WHATSAPP_CARD_BUTTON,
  WHATSAPP_CTA_LABEL,
} from "../src/lib/admin/package-detail-links";
import {
  PACKAGE_DERIVED,
  PACKAGE_RELATIONS,
  PACKAGE_SCALARS,
} from "../src/lib/admin/package-scalars";
import { buildValidator, errorMap } from "../src/lib/admin/validate";
import type { Prisma } from "../src/generated/prisma/client";

const BASE = process.env.PACKAGE_TEST_BASE ?? "http://localhost:3000";

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
async function expectRollback(fn: (tx: Prisma.TransactionClient) => Promise<unknown>): Promise<unknown> {
  try {
    await prisma.$transaction(async (tx) => {
      await fn(tx);
      throw new Error("__rollback__");
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message !== "__rollback__") return error;
  }
  return null;
}

/** Nilai `__count` tiap repeater, untuk membandingkan dengan data aslinya. */
function counts(html: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [, name, value] of html.matchAll(/name="([A-Za-z.]+)\.__count" value="(\d+)"/g)) {
    out[name] = Number(value);
  }
  return out;
}

async function main() {
  const admin = await prisma.adminUser.findFirst({ orderBy: { createdAt: "asc" } });
  if (!admin) throw new Error("tidak ada AdminUser; jalankan `pnpm admin:create` lebih dulu");
  const auth = { cookie: `hb_admin_session=${await mintSession(admin.id, admin.email, admin.name)}` };

  const categories = await prisma.category.findMany({ orderBy: { order: "asc" } });
  if (categories.length === 0) throw new Error("tidak ada Category; jalankan `pnpm setup`");
  const options = categories.map((c) => ({ value: c.slug, label: c.navLabel }));

  const packages = await prisma.package.findMany({
    orderBy: [{ category: { order: "asc" } }, { order: "asc" }],
    include: {
      category: { select: { slug: true, kind: true } },
      pricing: {
        include: {
          columns: { orderBy: { order: "asc" } },
          rows: { orderBy: { order: "asc" }, include: { values: true } },
          items: { orderBy: { order: "asc" } },
        },
      },
      notes: { orderBy: { order: "asc" } },
      gallery: { orderBy: { order: "asc" } },
    },
  });
  if (packages.length === 0) throw new Error("tidak ada Package; jalankan `pnpm setup`");

  const listingOnly = packages.filter((p) => !p.hasDetailPage);
  const sample = packages.find((p) => p.pricing && p.pricing.columns.length > 0) ?? packages[0]!;

  console.log(
    `Menguji ${packages.length} paket (${listingOnly.length} tanpa halaman detail), contoh: ${sample.slug}\n`,
  );

  console.log("1. Gerbang akses");
  {
    const anon = await fetch(`${BASE}/adm-cms-hb/paket`, { redirect: "manual" });
    check("anonim dialihkan", anon.status === 307 || anon.status === 302, `status ${anon.status}`);
    check(
      "ke halaman login",
      anon.headers.get("location")?.includes("/adm-cms-hb/login") === true,
      anon.headers.get("location") ?? "(tanpa location)",
    );
    const ok = await fetch(`${BASE}/adm-cms-hb/paket`, { headers: auth, redirect: "manual" });
    check("admin boleh", ok.status === 200, `status ${ok.status}`);
  }

  console.log("\n2. Semua paket masuk daftar");
  {
    const html = await (await fetch(`${BASE}/adm-cms-hb/paket`, { headers: auth })).text();
    const linked = new Set([...html.matchAll(/href="\/adm-cms-hb\/paket\/([^"]+)"/g)].map((m) => m[1]!));
    eq("jumlah tautan = jumlah paket", linked.size, packages.length);

    const missing = packages.filter((p) => !linked.has(p.slug)).map((p) => p.slug);
    check("tiada paket yang hilang", missing.length === 0, missing.slice(0, 3).join(", "));

    const missingOpenTrip = listingOnly.filter((p) => !linked.has(p.slug)).map((p) => p.slug);
    check(
      "Open Trip tanpa detail juga punya tautan",
      missingOpenTrip.length === 0,
      `${listingOnly.length - missingOpenTrip.length}/${listingOnly.length} tertaut`,
    );

    check(
      "pencarian tidak error",
      (await fetch(`${BASE}/adm-cms-hb/paket?q=open`, { headers: auth })).status === 200,
    );
    check("paket dikelompokkan per kategori", (html.match(/class="admin-group"/g) ?? []).length > 0);
  }

  console.log(`\n3. Detail paket: ${sample.slug}`);
  {
    const res = await fetch(`${BASE}/adm-cms-hb/paket/${sample.slug}`, { headers: auth, redirect: "manual" });
    check("halaman ada", res.status === 200, `status ${res.status}`);
    const html = await res.text();

    const missing = packageFields(options)
      .filter((f) => f.kind !== "repeater")
      .filter((f) => !html.includes(`name="${f.name}"`))
      .map((f) => f.name);
    check("semua field skalar ada di HTML", missing.length === 0, missing.slice(0, 6).join(", "));

    check("id tersembunyi untuk mode ubah", html.includes('type="hidden" name="id"'));
    check("kategori terpilih di form", html.includes('name="categorySlug"'));
    check(
      "kategori saat ini terisi",
      html.includes(`<option value="${sample.category.slug}" selected>`) ||
        html.includes(`value="${sample.category.slug}" selected`),
    );

    // Paket tanpa halaman detail tidak boleh ditautkan ke URL publik.
    if (!sample.hasDetailPage) {
      check("tidak menautkan URL publik yang belum ada", !html.includes(`href="/${sample.slug}"`));
    } else {
      check("menautkan URL publik", html.includes(`href="/${sample.slug}"`));
    }
  }

  console.log("\n4. Accordion tidak menyembunyikan field");
  {
    const html = await (await fetch(`${BASE}/adm-cms-hb/paket/${sample.slug}`, { headers: auth })).text();
    // Section yang tertutup tetap harus ada di DOM; kalau tidak, nilainya tidak
    // ikut FormData dan menutup section berarti menghapus isinya saat disimpan.
    const panels = [...html.matchAll(/data-section-panel="([^"]+)"/g)].map((m) => m[1]!);
    check("semua section ter-render", panels.length >= 8, panels.join(", "));

    const bodies = [...html.matchAll(/class="live-accordion__body" id="live-section-([^"]+)"/g)].map(
      (m) => m[1]!,
    );
    check("tiada section yang hilang dari DOM", bodies.length === panels.length, `${bodies.length}/${panels.length}`);

    const collapsed = [...html.matchAll(/id="live-section-([^"]+)"[^>]*hidden/g)].length;
    check("section tertutup ditandai hidden", collapsed > 0, `${collapsed} tertutup`);

    // `hidden` tidak menghentikan input ikut terkirim, `disabled` yang iya.
    check("input di section tertutup tidak disabled", !/<(input|textarea|select)[^>]*disabled[^>]*>/.test(html));
  }

  console.log("\n5. Matriks harga terpasang ke kolom yang benar");
  {
    const html = await (await fetch(`${BASE}/adm-cms-hb/paket/${sample.slug}`, { headers: auth })).text();
    const htmlCounts = counts(html);
    const pricing = sample.pricing;

    if (!pricing) {
      check("paket ini tidak punya tabel harga — dilewati", true, "n/a");
    } else {
      eq("jumlah kolom", htmlCounts.pricingColumns, pricing.columns.length);
      eq("jumlah baris", htmlCounts.pricingRows, pricing.rows.length);
      eq("jumlah item harga", htmlCounts.pricingItems, pricing.items.length);

      // `key` kolom harus berisi id kolom asli, bukan indeks atau cuid baru.
      // Field teks kini textarea auto-grow: nilai bisa jadi atribut `value`
      // (input) atau isi elemen (`>nilai</textarea>`).
      const keys = [
        ...html.matchAll(/name="pricingColumns\.0\.key"[^>]*?value="([^"]*)"/g),
        ...html.matchAll(/name="pricingColumns\.0\.key"[^>]*>([^<]*)<\/textarea>/g),
      ].map((m) => m[1]);
      const firstId = pricing.columns[0]?.id;
      if (pricing.columns.length > 0 && firstId) {
        check("baris kolom punya kunci", keys.length === 1 && keys[0] !== "", keys[0] ?? "(kosong)");
        eq("kunci kolom = id kolom asli", keys[0], firstId);
      }

      const expectedCellIds = new Set(pricing.rows.flatMap((row) => row.values.map((v) => v.columnId)));
      const cellIds = [
        ...new Set([...html.matchAll(/name="pricingRows\.\d+\.values\.([^"]+)"/g)].map((m) => m[1]!)),
      ];
      eq("jumlah kolom sel matriks", cellIds.length, expectedCellIds.size);
      const stray = cellIds.filter((id) => !expectedCellIds.has(id));
      check("sel matriks memakai id kolom yang ada", stray.length === 0, stray.slice(0, 3).join(", "));
    }
  }

  console.log("\n6. Allowlist kolom = spec");
  {
    const specScalars = packageFields(options)
      .filter((f) => f.kind !== "repeater")
      .map((f) => f.name)
      .filter(
        (name) =>
          !RELATIONS.has(name) && !DERIVED.has(name) && !PRICING_NAMES.has(name) && name !== "categorySlug",
      );

    const notAllowed = specScalars.filter((name) => !SCALARS.has(name));
    check("semua field skalar ada di allowlist", notAllowed.length === 0, notAllowed.join(", "));

    const unused = [...SCALARS].filter((name) => !specScalars.includes(name));
    check("tidak ada allowlist yang tak terpakai", unused.length === 0, unused.join(", "));

    // Kolom yang boleh masuk Prisma harus ada di model sungguhan.
    const scalarColumns = new Set(Object.keys(prisma.package.fields));
    const fake = [...SCALARS].filter((name) => !scalarColumns.has(name));
    check("semua nama allowlist ada di model Package", fake.length === 0, fake.join(", "));
  }

  console.log("\n7. Round-trip: FormData → parse → Prisma (rollback)");
  {
    const fields = packageFields(options);
    const validator = buildValidator(fields);
    const form = new FormData();

    for (const field of fields) {
      if (field.kind === "repeater") {
        form.set(`${field.name}.__count`, "0");
      } else if (field.kind === "boolean") {
        if (field.name === "hasDetailPage") form.set(field.name, "on");
      } else if (field.kind === "number") {
        form.set(field.name, "1");
      } else if (field.kind === "select") {
        form.set(field.name, field.options[0]?.value ?? "");
      } else if (field.kind === "image" || field.kind === "strings" || field.list) {
        form.set(field.name, "");
      } else {
        form.set(field.name, "");
      }
    }
    form.set("categorySlug", sample.category.slug);
    form.set("name", "Paket uji smoke");
    form.set("heroTitle", "Judul uji");

    const parsed = validator.safeParse(parseFields(form, fields));
    if (!parsed.success) {
      check("lolos validasi", false, JSON.stringify(errorMap(parsed.error)));
    } else {
      check("lolos validasi", true);

      const stray = Object.keys(parsed.data).filter(
        (key) =>
          !SCALARS.has(key) &&
          !RELATIONS.has(key) &&
          !DERIVED.has(key) &&
          !PRICING_NAMES.has(key) &&
          key !== "categorySlug",
      );
      check("semua kunci hasil parse dikenal action", stray.length === 0, stray.join(", "));

      // Bentuk `data` yang sama dengan yang action buat, lalu benar-benar
      // diterima Prisma di dalam transaksi yang dibatalkan.
      const data = parsed.data as Record<string, unknown>;
      const columns: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data)) {
        if (SCALARS.has(key)) columns[key] = value;
      }
      const error = await expectRollback((tx) =>
        tx.package.update({
          where: { id: sample.id },
          data: {
            ...columns,
            name: String(data.name),
            slug: sample.slug,
            category: { connect: { id: sample.categoryId } },
            kind: sample.category.kind,
            cardDays: { deleteMany: {}, create: [] },
            cardPrices: { deleteMany: {}, create: [] },
            cardFacilities: { deleteMany: {}, create: [] },
            itinerary: { deleteMany: {}, create: [] },
            facilities: { deleteMany: {}, create: [] },
            notes: { deleteMany: {}, create: [{ icon: "ℹ️", text: "catatan uji", order: 0 }] },
            gallery: { deleteMany: {}, create: [] },
            pricing: { delete: true },
          },
          select: { id: true },
        }),
      );
      check("update diterima Prisma", error === null, error ? String(error) : "");
    }
  }

  console.log("\n8. Halaman beranda");
  {
    const res = await fetch(`${BASE}/adm-cms-hb/kategori/beranda`, { headers: auth, redirect: "manual" });
    check("halaman beranda ada", res.status === 200, `status ${res.status}`);
    const html = await res.text();

    const missing = homeFields
      .filter((f) => f.kind !== "repeater")
      .filter((f) => !html.includes(`name="${f.name}"`))
      .map((f) => f.name);
    check("semua field skalar ada di HTML", missing.length === 0, missing.slice(0, 6).join(", "));

    const settings = await prisma.siteSettings.findFirst();
    check("judul hero terisi dari SiteSettings", Boolean(settings?.homeHeroTitle), settings?.homeHeroTitle ?? "-");
    check(
      "kolom CTA ikut terisi — bloknya dipakai juga di halaman paket",
      Boolean(settings?.ctaTitle),
      settings?.ctaTitle ?? "-",
    );

    const htmlCounts = counts(html);
    eq("jumlah statistik", htmlCounts.stats, await prisma.homeStat.count());
    eq(
      "jumlah keunggulan beranda",
      htmlCounts.benefits,
      await prisma.benefit.count({ where: { isHomepage: true } }),
    );
    eq("jumlah testimoni", htmlCounts.testimonials, await prisma.testimonial.count());

    check(
      "form beranda tidak menulis kolom CTA kategori",
      !homeFields.some((f) => f.name === "ctaPrimaryLabel"),
    );
    check(
      "form beranda tidak menulis kolom identitas situs",
      !homeFields.some((f) => ["siteUrl", "footerText"].includes(f.name)),
    );
  }

  console.log("\n9. Kategori memuat entri Beranda");
  {
    const html = await (await fetch(`${BASE}/adm-cms-hb/kategori`, { headers: auth })).text();
    check("tautan ke /adm-cms-hb/kategori/beranda", html.includes('href="/adm-cms-hb/kategori/beranda"'));
    check("tautan ke /adm-cms-hb/paket tersedia di sidebar", html.includes('href="/adm-cms-hb/paket"'));
  }

  console.log("\n10. Alur paket baru");
  {
    // Kategori di popup dikirim dari server, jadi daftar paket harus memuat
    // tombolnya. Isi popup sendiri baru muncul setelah klik (state client),
    // jadi yang bisa diperiksa dari HTML adalah kehadiran tombolnya.
    const listing = await (await fetch(`${BASE}/adm-cms-hb/paket`, { headers: auth })).text();
    check('tombol "Paket Baru" ada di daftar', listing.includes("Paket Baru"));
    check("tombol menandai dialog", listing.includes('aria-haspopup="dialog"'));

    // Tanpa kategori yang jelas, halaman baru tidak bisa menentukan `kind` dan
    // `hasDetailPage`, jadi harus mengembalikan user ke daftar.
    const noCategory = await fetch(`${BASE}/adm-cms-hb/paket/baru`, { headers: auth, redirect: "manual" });
    check(
      "tanpa kategori diarahkan ke daftar",
      [302, 303, 307].includes(noCategory.status),
      `status ${noCategory.status}`,
    );
    check(
      "arahkan ke /adm-cms-hb/paket",
      noCategory.headers.get("location")?.includes("/adm-cms-hb/paket") === true,
      noCategory.headers.get("location") ?? "(tanpa location)",
    );

    const bogus = await fetch(`${BASE}/adm-cms-hb/paket/baru?kategori=tidak-ada`, {
      headers: auth,
      redirect: "manual",
    });
    check(
      "kategori tidak dikenal juga ke daftar",
      [302, 303, 307].includes(bogus.status),
      `status ${bogus.status}`,
    );

    const res = await fetch(`${BASE}/adm-cms-hb/paket/baru?kategori=${sample.category.slug}`, {
      headers: auth,
      redirect: "manual",
    });
    check("halaman ada", res.status === 200, `status ${res.status}`);
    const html = await res.text();

    check(
      "kategori terpilih di form",
      html.includes(`value="${sample.category.slug}" selected`),
      `kategori ${sample.category.slug}`,
    );

    const missing = packageFields(options)
      .filter((f) => f.kind !== "repeater")
      .filter((f) => !html.includes(`name="${f.name}"`))
      .map((f) => f.name);
    check("semua field skalar ada di HTML", missing.length === 0, missing.slice(0, 6).join(", "));

    // Mode buat, bukan mode ubah: `id` tidak boleh terkirim, kalau tidak action
    // akan memperbarui paket lama alih-alih membuat yang baru.
    check("tidak mengirim id paket", !html.includes('type="hidden" name="id"'));

    // Preview harus memakai shell publik sungguhan, kalau tidak `.hb2d1n` dan
    // friends tidak akan tergambar dan user menilai design yang salah.
    check("preview memakai shell publik", html.includes("hb2d1n--package"));
    check("preview punya navigasi dan tombol WhatsApp", html.includes("sticky-wa") && html.includes("main-nav"));
  }

  console.log("\n12. Tombol Open Trip ikut aturan halaman detail");
  {
    /**
     * Preview dikirim dari client: state awal di HTML dibangun dari data
     * tersimpan, jadi HTTP hanya bisa memeriksa paket yang keadaannya sudah
     * final. Pasangan keadaan (detail aktif vs nonaktif) ditutup oleh
     * pemeriksaan `syncDetailLinks()` di bawahnya.
     */
    const openTrip = packages.find((p) => p.kind === "OPEN_TRIP" && p.hasDetailPage);
    const openTripTanpaDetail = packages.find((p) => p.kind === "OPEN_TRIP" && !p.hasDetailPage);
    check("ada Open Trip untuk diuji", Boolean(openTrip), openTrip?.slug ?? "(tidak ada)");

    if (openTrip) {
      // Paket yang halamannya sudah aktif harus tampil seperti paket private:
      // kartu membuka detail, tombol WhatsApp ada di hero.
      const editor = await (await fetch(`${BASE}/adm-cms-hb/paket/${openTrip.slug}`, { headers: auth })).text();
      check(
        "editor memuat tombol detail di preview",
        editor.includes(DETAIL_CARD_BUTTON),
        openTrip.cardButtonLabel || "(label kosong)",
      );
      check(
        "editor memuat tombol WhatsApp di preview hero",
        editor.includes(WHATSAPP_CTA_LABEL),
        openTrip.ctaPrimaryLabel || "(label kosong)",
      );
    }

    if (openTripTanpaDetail) {
      // Arah sebaliknya: tanpa halaman detail tidak boleh ada tombol detail,
      // karena tautannya akan mengarah ke URL yang tidak ada.
      const editor = await (await fetch(`${BASE}/adm-cms-hb/paket/${openTripTanpaDetail.slug}`, { headers: auth })).text();
      check(
        "Open Trip tanpa detail tidak menampilkan tombol detail",
        !editor.includes(DETAIL_CARD_BUTTON),
        openTripTanpaDetail.slug,
      );
      check(
        "Open Trip tanpa detail menampilkan tombol WhatsApp",
        editor.includes(WHATSAPP_CARD_BUTTON),
        openTripTanpaDetail.cardButtonLabel || "(label kosong)",
      );
    }

    if (openTrip) {
      // `syncDetailLinks()` murni dan tanpa efek samping, jadi cukup dicek
      // langsung: menulis ke DB hanya untuk membuktikan aturan ini tidak
      // sebanding dengan risiko merusak data asli.
      const after = syncDetailLinks({
        kind: openTrip.kind,
        hasDetailPage: true,
        cardLinkMode: openTrip.cardLinkMode ?? "",
        cardButtonLabel: openTrip.cardButtonLabel ?? "",
        ctaPrimaryLabel: openTrip.ctaPrimaryLabel,
      });
      check(
        "kartu pindah ke halaman detail",
        after.cardLinkMode === "detail",
        `cardLinkMode ${after.cardLinkMode}`,
      );
      check(
        "label kartu jadi tombol detail",
        after.cardButtonLabel === DETAIL_CARD_BUTTON,
        after.cardButtonLabel,
      );
      check(
        "hero dapat tombol WhatsApp",
        after.ctaPrimaryLabel === WHATSAPP_CTA_LABEL,
        after.ctaPrimaryLabel,
      );

      // Arah sebaliknya wajib benar juga: `cardLinkMode = "detail"` pada paket
      // tanpa halaman detail akan menautkan ke URL yang tidak ada.
      const off = syncDetailLinks({
        kind: "OPEN_TRIP",
        hasDetailPage: false,
        cardLinkMode: "detail",
        cardButtonLabel: DETAIL_CARD_BUTTON,
        ctaPrimaryLabel: WHATSAPP_CTA_LABEL,
      });
      check("matikan halaman detail -> kartu kembali ke WhatsApp", off.cardLinkMode === "whatsapp", off.cardLinkMode);
      check(
        "matikan halaman detail -> label kartu kembali ke WhatsApp",
        off.cardButtonLabel === WHATSAPP_CARD_BUTTON,
        off.cardButtonLabel,
      );

      // Paket private selalu punya halaman detail, jadi aturan ini tidak boleh
      // menyentuhnya — kalau iya, label kustom private ikut tertimpa.
      const priv = packages.find((p) => p.kind === "PRIVATE");
      if (priv) {
        const same = syncDetailLinks({
          kind: "PRIVATE",
          hasDetailPage: true,
          cardLinkMode: priv.cardLinkMode ?? "",
          cardButtonLabel: priv.cardButtonLabel ?? "",
          ctaPrimaryLabel: priv.ctaPrimaryLabel,
        });
        check(
          "paket private tidak diubah aturan ini",
          same.cardLinkMode === priv.cardLinkMode && same.cardButtonLabel === priv.cardButtonLabel,
          `${same.cardLinkMode} / ${same.cardButtonLabel}`,
        );
      }
    }
  }

  console.log("\n13. Hero tanpa label tidak menampilkan tombol kosong");
  {
    // Tanpa kondisi, `Hero` selalu merender anchor WhatsApp meski labelnya
    // kosong: user melihat tombol tanpa tulisan yang tetap menuju chat.
    const kosong: HeroProps = {
      waNumber: "6281234567890",
      waMessage: "halo",
      title: "uji",
      description: "",
      badges: [],
      accent: "",
      suffix: "",
      decos: [],
      primaryLabel: "",
      secondaryLabel: "",
      secondaryAnchor: "#itinerary",
    };
    const html = await renderToString(Hero(kosong));
    check("tidak ada tombol primary kosong", !html.includes("btn-primary"), html.slice(0, 160));
    check("tidak ada tombol ghost kosong", !html.includes("btn-ghost"), html.slice(0, 160));

    const filled = await renderToString(Hero({ ...kosong, primaryLabel: WHATSAPP_CTA_LABEL }));
    check("label terisi tetap dirender", filled.includes("btn-primary"), filled.slice(0, 160));
  }

  console.log("\n13b. Tombol sekunder hero mengikuti teks labelnya");
  {
    const pkgAnchors = { itinerary: "itinerary", facilities: "fasilitas", pricing: "harga", gallery: "galeri" };
    eq(
      "teks itinerary menuju #itinerary",
      resolveSecondaryAnchor("📋 Lihat Itinerary", pkgAnchors, "itinerary", "itinerary"),
      "#itinerary",
    );
    eq(
      "teks fasilitas menuju #fasilitas",
      resolveSecondaryAnchor("Lihat Fasilitas", pkgAnchors, "itinerary", "itinerary"),
      "#fasilitas",
    );
    eq(
      "teks harga menuju #harga",
      resolveSecondaryAnchor("Lihat Harga", pkgAnchors, "itinerary", "itinerary"),
      "#harga",
    );

    const catAnchors = { benefits: "keunggulan", listing: "paket" };
    eq(
      "teks keunggulan menuju #keunggulan",
      resolveSecondaryAnchor("Lihat Keunggulan", catAnchors, "paket", "listing"),
      "#keunggulan",
    );
    eq(
      "teks paket menuju #paket",
      resolveSecondaryAnchor("Lihat Paket", catAnchors, "paket", "listing"),
      "#paket",
    );

    // Teks tak dikenali / anchor tidak tersedia harus tetap punya tujuan,
    // supaya tombol tidak menggantung tanpa arah.
    eq(
      "teks tak dikenali memakai anchor cadangan",
      resolveSecondaryAnchor("Selengkapnya", catAnchors, "paket", "listing"),
      "#paket",
    );
    eq(
      "anchor cadangan tidak valid jatuh ke preferred",
      resolveSecondaryAnchor("Selengkapnya", catAnchors, "entah", "listing"),
      "#paket",
    );
    eq(
      "anchor bagian tidak tersedia jatuh ke cadangan",
      resolveSecondaryAnchor("Lihat Galeri", { itinerary: "itinerary", facilities: "fasilitas" }, "itinerary", "itinerary"),
      "#itinerary",
    );
    eq(
      "tanpa anchor sama sekali tidak menggantung",
      resolveSecondaryAnchor("Lihat Paket", {}, undefined, "listing"),
      undefined,
    );
  }

  console.log("\n14. Tulis ulang tabel harga untuk paket yang tidak punya tabel");
  {
    /**
     * Urutan tulis yang sama seperti `savePackageAction`.
     *
     * `Pricing` itu relasi satu-ke-satu, jadi bentuk `pricing: { delete: true }`
     * di dalam `package.update()` hanya jalan kalau barisnya sudah ada. 13 Open
     * Trip bawaan justru tidak punya tabel harga sama sekali — tanpa sadari,
     * menyimpan salah satunya selalu gagal dengan P2025, termasuk saat yang
     * diubah cuma satu checkbox. Baris lamanya dihapus terpisah lewat
     * `deleteMany`, yang tidak peduli tabelnya pernah ada atau tidak.
     */
    const tanpaHarga = packages.find((p) => !p.pricing);
    check("ada paket tanpa tabel harga", Boolean(tanpaHarga), `${listingOnly.length} paket`);

    if (tanpaHarga) {
      const error = await expectRollback(async (tx) => {
        await tx.package.update({
          where: { id: tanpaHarga.id },
          data: { hasDetailPage: true },
        });
        await tx.pricing.deleteMany({ where: { packageId: tanpaHarga.id } });
      });
      check("paket tanpa tabel harga bisa disimpan", error === null, error ? String(error) : "");
    }

    // Paket yang tabelnya sudah ada harus tetap bisa ditulis ulang penuh,
    // termasuk sel harga yang menunjuk ke kolom hasil create baru.
    const error = await expectRollback(async (tx) => {
      await tx.package.update({ where: { id: sample.id }, data: { hasDetailPage: true } });
      await tx.pricing.deleteMany({ where: { packageId: sample.id } });

      const created = await tx.pricing.create({
        data: { package: { connect: { id: sample.id } }, kind: "TABLE" },
        select: { id: true },
      });
      const columns = [];
      for (const [index, label] of ["Jumlah", "Harga"].entries()) {
        columns.push(
          await tx.priceColumn.create({
            data: { pricingId: created.id, label, order: index + 1 },
            select: { id: true },
          }),
        );
      }
      const row = await tx.priceRow.create({
        data: {
          pricingId: created.id,
          label: "2 orang",
          values: { create: [{ columnId: columns[0]!.id, value: "2" }] },
        },
        select: { values: true },
      });
      if (row.values.length !== 1) throw new Error("sel harga tidak ikut ditulis");
    });
    check("paket bertabel harga bisa ditulis ulang", error === null, error ? String(error) : "");
  }

  console.log(`\n${pass} lulus, ${fail} gagal`);
  if (fail > 0) process.exit(1);
}

const PRICING_NAMES = new Set([
  "pricingKind",
  "pricingNote",
  "pricingRowHeaderLabel",
  "pricingColumns",
  "pricingRows",
  "pricingItems",
]);

const SCALARS = new Set<string>(PACKAGE_SCALARS);
const RELATIONS = new Set<string>(PACKAGE_RELATIONS);
const DERIVED = new Set<string>(PACKAGE_DERIVED);

main().catch((error) => {
  console.error(error);
  process.exit(1);
});