/**
 * Cek akun admin yang ada: email, role, status, dan apakah passworddev yang
 * tercatat masih cocok dengan hash di database.
 *
 * Dipakai sebagai sanity check sebelum migrate ke production — kalau kandidat
 * password sudah tidak cocok, berarti `.env`/dokumen perlu diperbarui.
 */
import "dotenv/config";

import { prisma } from "../src/lib/db";
import { verifyPassword } from "../src/lib/password";

/**
 * Kandidat password untuk dicek TIDAK lagi ditulis di kode (dulu berisi daftar
 * password asli — kalau repo bocor, akun langsung bisa ditebak). Isi lewat
 * `ADMIN_PASSWORD` (dan opsional `ADMIN_LEGACY_PASSWORD`) di `.env`.
 */
const CANDIDATES = [process.env.ADMIN_PASSWORD, process.env.ADMIN_LEGACY_PASSWORD].filter(
  (v): v is string => Boolean(v),
);

async function main() {
  const users = await prisma.adminUser.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      passwordHash: true,
      createdAt: true,
    },
  });

  console.log(`${users.length} AdminUser:\n`);

  for (const user of users) {
    const matched: string[] = [];
    for (const candidate of CANDIDATES) {
      if (await verifyPassword(candidate, user.passwordHash)) matched.push(candidate);
    }

    console.log(
      [
        `  email      : ${user.email}`,
        `  nama       : ${user.name}`,
        `  role       : ${user.role}`,
        `  dibuat     : ${user.createdAt.toISOString()}`,
        `  hash       : ${user.passwordHash.slice(0, 20)}… (${user.passwordHash.length} karakter)`,
        `  kandidat yang cocok: ${matched.length ? matched.join(", ") : "TIDAK ADA"}`,
        "",
      ].join("\n"),
    );
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
