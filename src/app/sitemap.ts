import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/seo";
import { getCategorySlugs, getPackageSlugs } from "@/lib/site";

// Daftar URL ikut revalidasi 1 jam — sama dengan halaman yang dirujuknya,
// jadi sitemap tidak pernah menyimpan slug yang sudah dihapus/draft lama.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const [categories, packages] = await Promise.all([
    getCategorySlugs(),
    getPackageSlugs(),
  ]);

  const home: MetadataRoute.Sitemap[number] = {
    url: absoluteUrl("/"),
    lastModified: now,
    changeFrequency: "daily",
    priority: 1,
  };

  const categoryEntries: MetadataRoute.Sitemap = categories.map((slug) => ({
    url: absoluteUrl(`/${slug}`),
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  // Paket punya detail page (harga, itinerary) — paling sering dicari
  // orang, jadi prioritasnya setara sedikit di bawah beranda.
  const packageEntries: MetadataRoute.Sitemap = packages.map((slug) => ({
    url: absoluteUrl(`/${slug}`),
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.9,
  }));

  // Halaman link-bio (`/bio/...`) sengaja TIDAK dimasukkan: isinya
  // duplikat dari paket/kategori dan menambahnya hanya mengencerkan
  // kualitas sitemap di mata mesin pencari.
  return [home, ...categoryEntries, ...packageEntries];
}
