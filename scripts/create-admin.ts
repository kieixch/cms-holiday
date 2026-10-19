/**
 * Membuat atau memperbarui akun admin.
 *
 * Dipakai untuk membuat akun pertama, atau mereset password bila lupa.
 * Email dan password bisa dilewati lewat env (`ADMIN_EMAIL`, `ADMIN_PASSWORD`)
 * atau diberi sebagai argumen:
 *
 *   pnpm admin:create -- admin@holidaybanyuwangi.com "password-rahasia"
 */

import "dotenv/config";

import { prisma } from "../src/lib/db";
import { hashPassword } from "../src/lib/password";

async function main() {
  // `pnpm run x -- args` meneruskan "--" sebagai argumen pertama.
  const args = process.argv.slice(2).filter((a) => a !== "--");
  const [emailArg, passwordArg] = args;

  const email = (emailArg ?? process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = passwordArg ?? process.env.ADMIN_PASSWORD ?? "";

  if (!email || !password) {
    console.error(
      "Email atau password kosong. Contoh:\n" +
        "  pnpm admin:create -- admin@holidaybanyuwangi.com \"password-rahasia\"",
    );
    process.exit(1);
  }

  if (password === "ganti-password-ini" || password.length < 8) {
    console.error("Password terlalu pendek (minimal 8 karakter).");
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.adminUser.upsert({
    where: { email },
    update: { passwordHash, passwordChangedAt: new Date() },
    create: { email, name: "Admin", passwordHash },
    select: { id: true, email: true, name: true },
  });

  console.log(`Admin siap: ${user.email} (${user.id})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
