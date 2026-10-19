/**
 * Setel latar cinematic hero kategori pada database yang sudah terisi.
 *
 * Jalankan: `npx tsx scripts/apply-category-heroes.ts`
 *
 * Idempoten: hanya memperbarui slug yang ada di `category-heroes.ts`, dan bisa
 * dijalankan berkali-kali tanpa efek samping. Dipakai sekali untuk mengisi
 * database existing tanpa menjalankan `pnpm import` yang menghapus semua konten.
 */
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { categoryHero } from "./category-heroes";

const SLUGS = [
  "open-trip-banyuwangi",
  "private-trip-banyuwangi-half-day",
  "private-trip-banyuwangi-full-day",
  "private-trip-banyuwangi-2d1n",
  "private-trip-banyuwangi-3d2n",
  "private-trip-banyuwangi-4d3n",
];

async function main() {
  for (const slug of SLUGS) {
    const hero = categoryHero(slug);
    const existing = await prisma.category.findUnique({ where: { slug }, select: { id: true } });
    if (!existing) {
      console.log(`lewati ${slug} (kategori tidak ada)`);
      continue;
    }
    await prisma.category.update({ where: { slug }, data: hero });
    console.log(`✓ ${slug} → ${hero.heroImage?.replace("https://holidaybanyuwangi.com/wp-content/uploads/", "")}`);
  }
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  prisma.$disconnect();
  process.exit(1);
});
