import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { storageConfigured } from "@/lib/storage";

import { GalleryGrid } from "./gallery-grid";
import { GalleryNavProvider, GallerySkeletonGate } from "./gallery-nav";
import { GalleryPager } from "./gallery-pager";
import { GalleryUploader } from "./gallery-uploader";
import { clampPer, DEFAULT_PER, galleryHref } from "./pagination";

export const metadata: Metadata = { title: "Galeri — Admin" };

export default async function GalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; per?: string; galat?: string; ok?: string }>;
}) {
  // Guard eksplisit, bukan hanya andalkan layout panel.
  await requireAdmin();

  const { q, page: pageParam, per: perParam, galat, ok } = await searchParams;
  const term = (q ?? "").trim();

  // `per` dikirim browser hasil pengukuran kolom grid (lihat GalleryGrid) supaya
  // satu halaman selalu 3 baris penuh. Nilai dari URL tetap dibatasi supaya
  // `?per=999999` tidak menarik seluruh tabel.
  const per = clampPer(Number.parseInt(perParam ?? "", 10) || DEFAULT_PER);
  const requestedPage = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);

  const where = term
    ? {
        OR: [
          { filename: { contains: term, mode: "insensitive" as const } },
          { alt: { contains: term, mode: "insensitive" as const } },
          { folder: { contains: term, mode: "insensitive" as const } },
        ],
      }
    : undefined;

  // Hitung dulu hasil filter supaya nomor halaman bisa dibatasi ke halaman
  // terakhir. Tanpa ini, `?page=999999999` memaksa OFFSET sangat besar.
  const [matched, total, folderRows] = await Promise.all([
    prisma.mediaAsset.count({ where }),
    prisma.mediaAsset.count(),
    prisma.mediaAsset.findMany({
      select: { folder: true },
      distinct: ["folder"],
      orderBy: { folder: "asc" },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(matched / per));
  const page = Math.min(requestedPage, totalPages);

  const pageHref = (next: number) => galleryHref({ page: next, per, term });

  // Aset bisa terhapus / pencarian menyempit sehingga halaman di URL melewati
  // halaman terakhir. Alihkan ke halaman yang valid supaya URL dan isi cocok.
  // Pesan ok/galat ikut dibawa supaya notifikasi hapus tidak hilang.
  if (requestedPage > page) redirect(galleryHref({ page, per, term, ok, galat }));

  const assets = await prisma.mediaAsset.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * per,
    take: per,
  });

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

      <GalleryNavProvider>
        {assets.length === 0 ? (
          <p className="admin-empty">
            {term
              ? `Tidak ada gambar yang cocok dengan "${term}".`
              : "Belum ada gambar. Unggah foto pertama di atas."}
          </p>
        ) : (
          <GallerySkeletonGate count={per}>
            <GalleryGrid assets={assets} per={per} term={term} backTo={pageHref(page)} />
          </GallerySkeletonGate>
        )}

        {totalPages > 1 && (
          <GalleryPager
            page={page}
            totalPages={totalPages}
            matched={matched}
            term={term}
            per={per}
          />
        )}
      </GalleryNavProvider>
    </>
  );
}

