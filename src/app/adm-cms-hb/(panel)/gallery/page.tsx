import type { Metadata } from "next";
import Link from "next/link";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { storageConfigured } from "@/lib/storage";

import { GalleryGrid } from "./gallery-grid";
import { GalleryUploader } from "./gallery-uploader";

export const metadata: Metadata = { title: "Galeri — Admin" };

export default async function GalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; galat?: string; ok?: string }>;
}) {
  // Guard eksplisit, bukan hanya andalkan layout panel.
  await requireAdmin();

  const { q, galat, ok } = await searchParams;
  const term = (q ?? "").trim();

  const [assets, folderRows, total] = await Promise.all([
    prisma.mediaAsset.findMany({
      where: term
        ? {
            OR: [
              { filename: { contains: term, mode: "insensitive" } },
              { alt: { contains: term, mode: "insensitive" } },
              { folder: { contains: term, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      take: 120,
    }),
    prisma.mediaAsset.findMany({
      select: { folder: true },
      distinct: ["folder"],
      orderBy: { folder: "asc" },
    }),
    prisma.mediaAsset.count(),
  ]);

  return (
    <>
      <header className="admin-head">
        <div>
          <h1>Galeri</h1>
          <p className="admin-head__sub">
            {total} aset tersimpan. Foto otomatis diperkecil dan dikonversi ke WebP saat
            diunggah, lalu bisa dicrop dan dizoom tanpa merusak file aslinya.
          </p>
        </div>
      </header>

      {!storageConfigured() && (
        <p className="admin-alert admin-alert--error">
          Driver <code>s3</code> aktif tapi <code>S3_*</code> belum lengkap. Upload akan
          gagal sampai bucket, kredensial, dan <code>S3_PUBLIC_URL</code> diisi.
        </p>
      )}

      {galat ? (
        <p className="admin-alert admin-alert--error">{galat}</p>
      ) : null}
      {ok ? <p className="admin-alert admin-alert--ok">{ok}</p> : null}

      <GalleryUploader folders={folderRows.map((f) => f.folder)} />

      <form className="admin-media-search" method="get">
        <input name="q" defaultValue={term} placeholder="Cari nama file, alt, atau folder" />
        <button type="submit" className="admin-btn admin-btn--small">
          Cari
        </button>
        {term && (
          <Link className="admin-btn admin-btn--small admin-btn--ghost" href="/adm-cms-hb/gallery">
            Reset
          </Link>
        )}
      </form>

      {assets.length === 0 ? (
        <p className="admin-empty">
          {term
            ? `Tidak ada gambar yang cocok dengan "${term}".`
            : "Belum ada gambar. Unggah foto pertama di atas."}
        </p>
      ) : (
        <GalleryGrid assets={assets} />
      )}
    </>
  );
}