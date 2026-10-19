/**
 * Util SEO: URL absolut untuk canonical/OG/sitemap dan pembangun JSON-LD
 * (schema.org) yang dipakai halaman publik.
 *
 * Basis URL dibaca dari `NEXT_PUBLIC_SITE_URL` supaya tetap benar walau domain
 * berganti (mis. custom domain di Vercel). Fallback-nya URL produksi sekarang,
 * jadi build tetap valid meski env belum diisi — isi env tetap disarankan
 * supaya `audit-baseline` dan URL internal ikut konsisten.
 */

import type { Metadata } from "next";

// Domain produksi. Catatan: apex `holidaybanyuwangi.com` di-redirect (308)
// ke `www`, jadi kanonik/OG/sitemap memakai www agar tidak dianggap halaman
// duplikat. Nilai ini hanya fallback — isi `NEXT_PUBLIC_SITE_URL` di Vercel
// dengan nilai yang sama (dan Redeploy) agar eksplisit.
const FALLBACK_SITE_URL = "https://www.holidaybanyuwangi.com";

/** Judul & deskripsi default; dipakai root layout dan halaman tanpa judul sendiri. */
export const SITE_TITLE = "Banyuwangi Holiday - Paket Tour Banyuwangi";
export const SITE_DESCRIPTION =
  "Paket tour Banyuwangi: open trip, private trip, WM 2D1N 3D2N 4D3N ke Kawah Ijen, Giri Keuwuran, Pulau Merah, dan pantai timur Banyuwangi.";

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || FALLBACK_SITE_URL).replace(/\/+$/, "");
}

/** URL absolut untuk path di situs ini ("/" atau "/paket-x"). */
export function absoluteUrl(path = "/"): string {
  return new URL(path, `${siteUrl()}/`).toString();
}

/** Media relatif (`/uploads/...`) jadi absolut; URL eksternal dibiarkan. */
export function absoluteMedia(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  return /^https?:\/\//i.test(url) ? url : absoluteUrl(url);
}

/** Deskripsi meta yang rapi: satu baris, maksimum ±160 karakter. */
export function metaDescription(text: string | null | undefined, fallback: string): string {
  const value = (text ?? "").replace(/\s+/g, " ").trim();
  if (!value) return fallback;
  if (value.length <= 160) return value;
  return `${value.slice(0, 157).trimEnd()}...`;
}

/**
 * Gambar OG generik dari file convention `src/app/opengraph-image.tsx`.
 * File itu menghasilkan URL stabil `/opengraph-image` yang Next simpan
 * otomatis HANYA pada objek openGraph/twitter milik layout root — begitu
 * halaman menimpa objeknya (shallow merge), otomatisasi itu hilang, jadi
 * helper di bawah menyuntikkannya kembali secara eksplisit.
 */
const OG_IMAGE_ALT =
  "Holiday Banyuwangi — Paket tour & open trip di Banyuwangi";
const ogImage = { url: absoluteUrl("/opengraph-image"), width: 1200, height: 630, alt: OG_IMAGE_ALT };

/**
 * `openGraph` lengkap untuk satu halaman.
 *
 * Next meng-merge metadata antar-segmen secara SHALLOW: `openGraph` yang
 * didefinisikan anak route menggantikan seluruh objek milik root layout —
 * jadi tiap halaman yang menimpa wajib membawa field penuhnya, bukan sebagian.
 */
export function pageOpenGraph(input: {
  title: string;
  description: string;
  path: string;
}): NonNullable<Metadata["openGraph"]> {
  return {
    type: "website",
    locale: "id_ID",
    siteName: "Holiday Banyuwangi",
    title: input.title,
    description: input.description,
    url: absoluteUrl(input.path),
    images: [ogImage],
  };
}

/** `twitter` lengkap — alasan shallow-merge yang sama seperti `pageOpenGraph`. */
export function pageTwitter(input: {
  title: string;
  description: string;
}): NonNullable<Metadata["twitter"]> {
  return {
    card: "summary_large_image",
    title: input.title,
    description: input.description,
    images: [ogImage.url],
  };
}

/* ------------------------------------------------------------------ */
/* JSON-LD (schema.org)                                                */
/*                                                                     */
/* Google tidak punya rich result khusus paket tour, jadi yang dipakai  */
/* adalah struktur yang sah dan jujur: identitas penyelenggara, situs,  */
/* breadcrumb, daftar item, dan TouristTrip — tanpa rating/ulasan       */
/* karangan.                                                            */
/* ------------------------------------------------------------------ */

/** Tipe struktural minimal dari `getSettings()` (settingsSelect). */
export type SeoSettings = {
  siteName: string;
  email: string;
  instagram: string;
  tiktok: string;
  waNumber: string;
};

/**
 * `@graph` beranda: penyelenggara tour + WebSite, saling terhubung lewat
 * `@id` supaya mesin pencari menggabungkan entitas ini dengan hasil
 * pencarian situs/organisasi.
 */
export function organizationGraph(settings: SeoSettings) {
  const organizationId = absoluteUrl("/#organization");
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "TravelAgency",
        "@id": organizationId,
        name: settings.siteName || "Holiday Banyuwangi",
        url: absoluteUrl("/"),
        email: settings.email,
        description:
          "Penyelenggara open trip dan private trip di Banyuwangi: Kawah Ijen, Pulau Merah, Baluran, Djawatan, dan destinasi timur Banyuwangi lainnya.",
        areaServed: { "@type": "City", name: "Banyuwangi" },
        address: {
          "@type": "PostalAddress",
          addressLocality: "Banyuwangi",
          addressRegion: "Jawa Timur",
          addressCountry: "ID",
        },
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer service",
          availableLanguage: "id",
          url: `https://wa.me/${settings.waNumber.replace(/[^\d]/g, "")}`,
        },
        sameAs: [settings.instagram, settings.tiktok].filter(Boolean),
      },
      {
        "@type": "WebSite",
        "@id": absoluteUrl("/#website"),
        url: absoluteUrl("/"),
        name: settings.siteName || "Holiday Banyuwangi",
        inLanguage: "id",
        publisher: { "@id": organizationId },
      },
    ],
  };
}

/** Breadcrumb: `[{ name: "Beranda", path: "/" }, ...]`. */
export function breadcrumbList(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

/** Daftar paket pada halaman kategori (urutan tampil di listing). */
export function itemList(name: string, entries: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: entries.length,
    itemListElement: entries.map((entry, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: entry.name,
      url: absoluteUrl(entry.path),
    })),
  };
}

/** Halaman detail paket: `TouristTrip` yang menunjuk penyelenggara lewat `@id`. */
export function touristTrip(input: {
  name: string;
  description: string;
  path: string;
  image?: string | undefined;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "TouristTrip",
    name: input.name,
    description: input.description,
    url: absoluteUrl(input.path),
    ...(input.image ? { image: input.image } : {}),
    touristType: "Wisatawan",
    provider: { "@id": absoluteUrl("/#organization") },
  };
}
