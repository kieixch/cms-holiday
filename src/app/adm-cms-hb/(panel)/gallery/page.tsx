import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { storageConfigured } from "@/lib/storage";

import { GalleryGrid } from "./gallery-grid";
import { GalleryUploader } from "./gallery-uploader";
import { clampPer, DEFAULT_PER, pageWindow } from "./pagination";

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

  const galleryHref = (next: number, extra?: { ok?: string; galat?: string }) => {
    const params = new URLSearchParams();
    if (term) params.set("q", term);
    if (per !== DEFAULT_PER) params.set("per", String(per));
    if (next > 1) params.set("page", String(next));
    if (extra?.ok) params.set("ok", extra.ok);
    if (extra?.galat) params.set("galat", extra.galat);
    const qs = params.toString();
    return `/adm-cms-hb/gallery${qs ? `?${qs}` : ""}`;
  };

  const pageHref = (next: number) => galleryHref(next);

  // Aset bisa terhapus / pencarian menyempit sehingga halaman di URL melewati
  // halaman terakhir. Alihkan ke halaman yang valid supaya URL dan isi cocok.
  // Pesan ok/galat ikut dibawa supaya notifikasi hapus tidak hilang.
  if (requestedPage > page) redirect(galleryHref(page, { ok, galat }));

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

      {assets.length === 0 ? (
        <p className="admin-empty">
          {term
            ? `Tidak ada gambar yang cocok dengan "${term}".`
            : "Belum ada gambar. Unggah foto pertama di atas."}
        </p>
      ) : (
        <GalleryGrid assets={assets} per={per} term={term} backTo={pageHref(page)} />
      )}

      {totalPages > 1 && (
        <nav className="admin-pagination" aria-label="Paginasi galeri">
          {page > 1 ? (
            <Link className="admin-pagination__step" href={pageHref(page - 1)} rel="prev">
              ‹ Sebelumnya
            </Link>
          ) : (
            <span className="admin-pagination__step" aria-disabled="true">
              ‹ Sebelumnya
            </span>
          )}

          {pageWindow(page, totalPages).map((item, index) =>
            item === "gap" ? (
              <span className="admin-pagination__gap" key={`gap-${index}`} aria-hidden="true">
                …
              </span>
            ) : (
              <Link
                key={item}
                className="admin-pagination__page"
                href={pageHref(item)}
                aria-current={item === page ? "page" : undefined}
              >
                {item}
              </Link>
            ),
          )}

          {page < totalPages ? (
            <Link className="admin-pagination__step" href={pageHref(page + 1)} rel="next">
              Berikutnya ›
            </Link>
          ) : (
            <span className="admin-pagination__step" aria-disabled="true">
              Berikutnya ›
            </span>
          )}

          {/* Form GET biasa: loncat halaman tetap jalan tanpa JavaScript. */}
          <form className="admin-pagination__jump" method="get">
            {term ? <input type="hidden" name="q" value={term} /> : null}
            {per !== DEFAULT_PER ? <input type="hidden" name="per" value={per} /> : null}
            <label className="admin-pagination__jump-label">
              Ke halaman
              <input
                type="number"
                name="page"
                min={1}
                max={totalPages}
                defaultValue={page}
                required
                aria-label="Nomor halaman tujuan"
              />
            </label>
            <button type="submit" className="admin-pagination__step">
              Lompat
            </button>
          </form>

          <span className="admin-pagination__info">
            {matched} foto · halaman {page} dari {totalPages}
          </span>
        </nav>
      )}
    </>
  );
}

