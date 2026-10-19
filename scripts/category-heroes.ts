/**
 * Latar cinematic hero tiap kategori.
 *
 * Sebelum field `Category.heroImage` ada, halaman kategori memakai foto paket
 * pertamanya. Dua kategori yang paket pertamanya sama (Gili Ijen dan Gili Ijen
 * 3D2N sama-sama memakai `GreenIsland1.jpeg`) jadi tampil dengan background
 * identik. Peta ini menetapkan satu foto per kategori — semuanya aset yang
 * memang sudah dipakai paket di kategori tersebut, jadi tidak ada aset baru dan
 * fotonya tetap relevan dengan isi halamannya.
 *
 * Dipakai oleh `pnpm import` (seed dari nol) dan `scripts/apply-category-heroes.ts`
 * (menyetel database yang sudah ada). Admin tetap bisa menggantinya lewat panel,
 * karena setelah diimpor sumber kebenarannya adalah kolom `Category.heroImage`.
 */

const WP = "https://holidaybanyuwangi.com/wp-content/uploads";

export type CategoryHero = { image: string; alt: string };

const HEROES: Record<string, CategoryHero> = {
  "open-trip-banyuwangi": {
    image: `${WP}/2026/02/mainmainbanyuwangi-2-scaled-1-e1781679067917.webp`,
    alt: "Rombongan peserta open trip Holiday Banyuwangi",
  },
  "private-trip-banyuwangi-half-day": {
    image: `${WP}/2026/06/landscape2-scaled-e1781679278850.webp`,
    alt: "Pemandangan Kawah Ijen saat pagi",
  },
  "private-trip-banyuwangi-full-day": {
    image: `${WP}/2026/06/PulauMerah1.jpeg`,
    alt: "Pantai Pulau Merah Banyuwangi",
  },
  "private-trip-banyuwangi-2d1n": {
    image: `${WP}/2026/06/GreenIsland1.jpeg`,
    alt: "Pulau Gili Ijen di Banyuwangi",
  },
  "private-trip-banyuwangi-3d2n": {
    image: `${WP}/2026/06/Menjangan3.jpeg`,
    alt: "Pulau Menjangan, Taman Nasional Bali Barat",
  },
  "private-trip-banyuwangi-4d3n": {
    image: `${WP}/2026/06/Menjangan5-scaled.jpeg`,
    alt: "Pulau Menjangan saat matahari terbenam",
  },
};

export function categoryHero(slug: string): { heroImage: string | null; heroImageAlt: string | null } {
  const hero = HEROES[slug];
  return hero
    ? { heroImage: hero.image, heroImageAlt: hero.alt }
    : { heroImage: null, heroImageAlt: null };
}
