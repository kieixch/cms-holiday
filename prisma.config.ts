import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx scripts/import-content.ts",
  },
  datasource: {
    // Migrasi sebaiknya lewat koneksi langsung (bukan pooler). Di Neon,
    // `DATABASE_URL` menunjuk host `-pooler`, sedangkan `DIRECT_URL` host
    // langsung; di dev keduanya sama, jadi fallback ke DATABASE_URL.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
});