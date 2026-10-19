import type { Metadata, Viewport } from "next";
import { Baloo_2, DM_Serif_Display, Inter } from "next/font/google";
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
  title: {
    default: "Banyuwangi Holiday - Paket Tour Banyuwangi",
    template: "%s | Banyuwangi Holiday",
  },
  description:
    "Paket tour Banyuwangi: open trip, private trip, WM 2D1N 3D2N 4D3N ke Kawah Ijen, Giri Keuwuran, Pulau Merah, dan pantai timur Banyuwangi.",
  keywords: [
    "tour Banyuwangi",
    "paket tour Banyuwangi",
    "Kawah Ijen",
    "Giri Keuwuran",
    "open trip Banyuwangi",
  ],
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
