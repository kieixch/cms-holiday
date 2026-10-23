import Image from "next/image";

import { imageUnoptimized } from "@/lib/media";

/**
 * Ringkas data kartu halaman HTML mandiri yang tampil di halaman publik.
 * Sumbernya `prisma.htmlPage` (panel admin → `/adm-cms-hb/halaman`).
 */
export type PageCardData = {
  slug: string;
  title: string;
  /** Label kecil di atas judul; kosong = tanpa tag. */
  cardTag: string;
  /** Judul kartu; kosong berarti memakai `title` halaman. */
  cardTitle: string;
  cardDesc: string;
  /** Label tombol; kosong = tanpa tombol. Tujuan tetap `/halaman/<slug>`. */
  cardButtonLabel: string;
  cardImage: string | null;
};

/**
 * Grid kartu redirect ke `/halaman/<slug>` — dokumen HTML dari panel admin.
 *
 * Baik di beranda (`homePg*`) maupun di halaman kategori (`pg*`), grid ini
 * dipakai bersama `<SectionHead>` di sekitarnya. Karena itu hanya grid-nya
 * yang diekspor; kepala seksi disisipkan oleh pemanggil.
 */
export function PageCardGrid({ pages }: { pages: PageCardData[] }) {
  if (pages.length === 0) return null;

  return (
    <div className="hbgl-pg-grid">
      {pages.map((page) => (
        <a key={page.slug} className="hbgl-pg-card" href={`/halaman/${page.slug}`}>
          {page.cardImage ? (
            <span className="hbgl-pg-card__media">
              {/* Host luar yang tidak terdaftar tetap dilewati optimizer;
                  media R2 dioptimalkan agar tidak bergantung pada akses
                  browser ke `r2.dev`. */}
              <Image
                src={page.cardImage}
                alt=""
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                unoptimized={imageUnoptimized(page.cardImage)}
              />
            </span>
          ) : null}
          <span className="hbgl-pg-card__body">
            {page.cardTag ? <span className="hbgl-pg-card__tag">{page.cardTag}</span> : null}
            <span className="hbgl-pg-card__title">{page.cardTitle || page.title}</span>
            {page.cardDesc ? (
              <span className="hbgl-pg-card__desc">{page.cardDesc}</span>
            ) : null}
            {page.cardButtonLabel ? (
              <span className="hbgl-pg-card__btn">{page.cardButtonLabel}</span>
            ) : null}
          </span>
        </a>
      ))}
    </div>
  );
}
