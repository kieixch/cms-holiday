import type { Metadata, Viewport } from "next";
import { Baloo_2, DM_Serif_Display, Inter } from "next/font/google";

import { SITE_DESCRIPTION, SITE_TITLE, siteUrl } from "@/lib/seo";

import "./globals.css";

/* Tipografi ulang sesuai DESIGN.md:
 *   - Inter -> isi (variabel --font-inter; legacy memakai --font-poppins yang
 *     di-alias ke Inter di green-palette.css, jadi semua isi ikut berganti).
 *   - DM Serif Display -> judul CTA banner saja,
 *     dipakai selektif dan tidak tebal.
 *   - Baloo_2 -> judul hero + judul section (weight 600/700/800) dan teks logo. */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const display = DM_Serif_Display({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

const baloo = Baloo_2({
  variable: "--font-baloo-2",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  // Basis absolut untuk canonical, OG, sitemap, dan robots — tanpa ini
  // semua URL metadata jadi relatif dan tidak terbaca mesin pencari.
  metadataBase: new URL(siteUrl()),
  title: {
    default: SITE_TITLE,
    template: "%s | Banyuwangi Holiday",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "tour Banyuwangi",
    "paket tour Banyuwangi",
    "Kawah Ijen",
    "Giri Keuwuran",
    "open trip Banyuwangi",
  ],
  applicationName: "Holiday Banyuwangi",
  // Default OG/Twitter untuk semua halaman; route yang punya halaman detail
  // menimpa `title`/`description`/`url`-nya sendiri di generateMetadata
  // (ingat: merge metadata Next bersifat shallow — lihat `pageOpenGraph`).
  openGraph: {
    type: "website",
    locale: "id_ID",
    siteName: "Holiday Banyuwangi",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: siteUrl(),
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  robots: { index: true, follow: true },
  // Verifikasi Google Search Console lewat env (konten meta disetel di
  // Vercel). Kosong = field ini tidak dirender sama sekali.
  ...(process.env.GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } }
    : {}),
};

export const viewport: Viewport = {
  themeColor: "#163C32",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${inter.variable} ${display.variable} ${baloo.variable} h-full`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
