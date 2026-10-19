import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/seo";

// Sitemap & robots di-ISR 1 jam supaya ikut ter-update setelah build/deploy
// baru tanpa menunggu crawlers mengambil versi basi.
export const revalidate = 3600;

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Panel admin & API tidak boleh di-crawl; API juga tidak punya
        // konten yang berguna dan dapat membanjiri log.
        disallow: ["/adm-cms-hb/", "/api/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
