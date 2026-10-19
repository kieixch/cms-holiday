/**
 * Tulis ulang `content/content.json` dari database.
 *
 * Jalankan: pnpm content:export
 */
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { CONTENT_FILE, syncContentFile } from "../src/lib/admin/content-export";

async function main() {
  const counts = await syncContentFile();

  console.log(`Sumber  : database`);
  console.log(`Tujuan  : ${CONTENT_FILE}`);
  console.log(
    `  kategori : ${counts.categories}\n` +
      `  paket    : ${counts.packages}\n` +
      `  halaman  : ${counts.pages}`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });