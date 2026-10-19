import fs from "node:fs/promises";
import path from "node:path";

/**
 * Menyajikan media untuk driver `local`.
 *
 *_media_ tidak bisa diletakkan di `public/`: Next.js mem-foto isi `public/`
 * saat build, jadi file yang diunggah setelah build tidak pernah tersaji dan
 * selalu 404 di produksi. Karena itu upload lokal ditulis ke `./storage/uploads`
 * dan dilayani dari sini.
 *
 * Route ini menyajikan file yang diunggah pengguna, jadi ekstensinya dibatasi
 * ketat. Tanpa itu, file HTML atau SVG bisa dilayani dari origin yang sama
 * dan jadi vektor XSS.
 */

const CONTENT_TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".avif": "image/avif",
  ".gif": "image/gif",
};

/**
 * Root dihitung per-request, bukan sekali di module scope.
 *
 * Selain env diambil saat request, `path.resolve` dengan path runtime ikut
 * membuat Turbopack menganggapnya filesystem access dinamis.
 */
function uploadRoot(): string {
  return path.resolve(process.env.STORAGE_LOCAL_PATH ?? "./storage/uploads");
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key?: string[] }> },
) {
  // Driver lain menyajikan URL absolut sendiri (R2), jadi route ini tidak aktif.
  if ((process.env.STORAGE_DRIVER ?? "local") !== "local") {
    return new Response("Not found", { status: 404 });
  }

  const { key } = await params;
  const parts = (key ?? []).filter(Boolean);
  if (parts.length === 0) return new Response("Not found", { status: 404 });

  const extension = path.extname(parts[parts.length - 1]).toLowerCase();
  const contentType = CONTENT_TYPES[extension];
  if (!contentType) return new Response("Not found", { status: 404 });

  const root = uploadRoot();
  const target = path.resolve(root, parts.join("/"));
  // Cegah `..` keluar dari root upload.
  if (!target.startsWith(root + path.sep)) {
    return new Response("Not found", { status: 404 });
  }

  let body: Buffer;
  try {
    body = await fs.readFile(target);
  } catch {
    return new Response("Not found", { status: 404 });
  }

  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": contentType,
      // Nama file selalu unik per upload, jadi aman di-cache lama.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
