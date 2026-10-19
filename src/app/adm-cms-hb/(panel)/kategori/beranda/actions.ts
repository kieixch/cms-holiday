"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { FormState } from "@/components/admin/admin-form";
import type { Prisma } from "@/generated/prisma/client";
import { parseFields } from "@/lib/admin/fields";
import { refreshAuditBaseline } from "@/lib/admin/audit-baseline";
import { trySyncContentFile } from "@/lib/admin/content-export";
import { bumpContentVersion } from "@/lib/content-version";
import { homeFields } from "@/lib/admin/home-fields";
import { buildValidator, errorMap } from "@/lib/admin/validate";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

const validator = buildValidator(homeFields);

/**
 * Kolom `SiteSettings` yang boleh ditulis form ini.
 *
 * Daftar ini disalin eksplisit, bukan diambil dari sisa `parseFields()`,
 * karena `SiteSettings` juga menyimpan identitas situs, kontak, dan footer.
 * Kalau tidak dibatasi, form beranda diam-diam bisa menimpa pengaturan umum.
 */
const SETTINGS_KEYS = [
  "homeHeroBadges",
  "homeHeroTitle",
  "homeHeroAccent",
  "homeHeroSuffix",
  "homeHeroText",
  "homeHeroDecos",
  "homeHeroImage",
  "homeHeroImageAlt",
  "homeHeroPrimaryLabel",
  "homeHeroWaLink",
  "waNumber",
  "waGreeting",
  "waMessage",
  "homeHeroSecondaryLabel",
  "homeHeroSecondaryAnchor",
  "homeTypesAnchor",
  "homeTypesTag",
  "homeTypesTitle",
  "homeTypesAccent",
  "homeTypesSuffix",
  "homeTypesDesc",
  "homeTypesEnabled",
  "homePgAnchor",
  "homePgTag",
  "homePgTitle",
  "homePgAccent",
  "homePgSuffix",
  "homePgDesc",
  "homePgEnabled",
  "homeFavTag",
  "homeFavTitle",
  "homeFavAccent",
  "homeFavSuffix",
  "homeFavDesc",
  "homeFavEnabled",
  "homeGridColumns",
  "homeBenefitsTag",
  "homeBenefitsTitle",
  "homeBenefitsAccent",
  "homeBenefitsSuffix",
  "homeBenefitsDesc",
  "homeBenefitsEnabled",
  "homeTestiTag",
  "homeTestiTitle",
  "homeTestiAccent",
  "homeTestiSuffix",
  "homeTestiDesc",
  "homeTestiEnabled",
  "homeIgTag",
  "homeIgTitle",
  "homeIgAccent",
  "homeIgSuffix",
  "homeIgDesc",
  "homeIgEnabled",
  "homeGalleryTag",
  "homeGalleryTitle",
  "homeGalleryAccent",
  "homeGallerySuffix",
  "homeGalleryDesc",
  "homeGalleryAnchor",
  "homeGalleryColumns",
  "homeGalleryEnabled",
  "ctaTitle",
  "ctaText",
  "ctaLabel",
  "ctaMessage",
  "ctaWaNumber",
  "ctaWaGreeting",
  "ctaWaLink",
  "ctaBackground",
] as const;

type Draft = Record<string, unknown>;

function str(value: unknown, fallback = ""): string {
  return value === null || value === undefined ? fallback : String(value);
}

function rows(value: unknown): Draft[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Draft => typeof item === "object" && item !== null);
}

function orderOf(value: unknown, index: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : index;
}

/**
 * Simpan seluruh isi halaman beranda.
 *
 * Statistik, keunggulan beranda, dan testimoni ditulis ulang penuh. Dua hal
 * yang perlu diperhatikan:
 *
 *   - `Benefit` dipakai bersama kategori lewat flag `isHomepage`, jadi filter
 *     `deleteMany` dan `create` di sini hanya menyentuh baris beranda. Keunggulan
 *     tiap kategori tetap utuh.
 *   - Blok CTA disimpan ke `SiteSettings`, jadi ikut berubah di semua halaman
 *     paket. Kalau itu tidak diinginkan, pemisahnya harus per halaman — bukan
 *     disamarkan di editor ini.
 */
export async function saveHomeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const result = validator.safeParse(parseFields(formData, homeFields));
  if (!result.success) return { errors: errorMap(result.error) };

  const data = result.data as Draft;

  const settings = await prisma.siteSettings.findFirst();
  if (!settings) {
    return { message: "SiteSettings belum diisi. Jalankan `pnpm db:seed` terlebih dahulu." };
  }

  const settingsColumns: Record<string, unknown> = {};
  for (const key of SETTINGS_KEYS) settingsColumns[key] = data[key];

  const stats = rows(data.stats).map((item, index) => ({
    num: str(item.num),
    label: str(item.label),
    order: orderOf(item.order, index),
  }));

  const benefits = rows(data.benefits).map((item, index) => ({
    icon: str(item.icon),
    title: str(item.title),
    description: str(item.description),
    order: orderOf(item.order, index),
  }));

  const testimonials = rows(data.testimonials).map((item, index) => ({
    stars: typeof item.stars === "number" ? item.stars : 5,
    quote: str(item.quote),
    author: str(item.author),
    location: str(item.location),
    order: orderOf(item.order, index),
  }));

  const gallery = rows(data.gallery).map((item, index) => ({
    url: str(item.url),
    alt: str(item.alt),
    order: orderOf(item.order, index),
  }));

  try {
    await prisma.$transaction(async (tx) => {
      await tx.siteSettings.update({
        where: { id: settings.id },
        data: settingsColumns as Prisma.SiteSettingsUpdateInput,
      });

      await tx.homeStat.deleteMany();
      if (stats.length > 0) await tx.homeStat.createMany({ data: stats });

      // Hanya baris beranda. `categoryId` sengaja dibiarkan null supaya
      // keunggulan ini tidak ikut terhapus saat kategorinya dihapus.
      await tx.benefit.deleteMany({ where: { isHomepage: true } });
      if (benefits.length > 0) {
        await tx.benefit.createMany({
          data: benefits.map((benefit) => ({ ...benefit, isHomepage: true, categoryId: null })),
        });
      }

      await tx.testimonial.deleteMany();
      if (testimonials.length > 0) await tx.testimonial.createMany({ data: testimonials });

      await tx.homeGalleryImage.deleteMany();
      if (gallery.length > 0) await tx.homeGalleryImage.createMany({ data: gallery });
    });
  } catch (error) {
    return { message: `Gagal menyimpan: ${describe(error)}` };
  }

  await trySyncContentFile();
  await refreshAuditBaseline();
  await bumpContentVersion();
  revalidatePath("/");
  revalidatePath("/adm-cms-hb/kategori");
  revalidatePath("/adm-cms-hb/kategori/beranda");

  redirect("/adm-cms-hb/kategori/beranda?tersimpan=1");
}

function describe(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = String((error as { code: unknown }).code);
    if (code === "P2003") return "ada data lain yang masih menunjuk ke pengaturan ini.";
  }
  return "terjadi kesalahan di server.";
}