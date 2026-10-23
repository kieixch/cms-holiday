"use client";

import Link from "next/link";
import type { FormEvent, MouseEvent } from "react";

import { useGalleryNav } from "./gallery-nav";
import { DEFAULT_PER, galleryHref, pageWindow } from "./pagination";

type GalleryPagerProps = {
  page: number;
  totalPages: number;
  matched: number;
  term: string;
  per: number;
};

/**
 * Pager galeri. Link tetap `<a href>` (bisa dibuka di tab baru / jalan tanpa
 * JS), tapi klik biasa dicegat dan dijalankan lewat transisi supaya skeleton
 * muncul seketika.
 */
export function GalleryPager({ page, totalPages, matched, term, per }: GalleryPagerProps) {
  const { pending, go } = useGalleryNav();
  const href = (next: number) => galleryHref({ page: next, per, term });
  const message = (next: number) => `Memuat halaman ${next} dari ${totalPages}…`;

  const follow = (next: number) => (event: MouseEvent<HTMLAnchorElement>) => {
    // Biarkan klik dengan modifier tetap membuka tab/jendela baru.
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    go(href(next), message(next));
  };

  const jump = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = Number(new FormData(event.currentTarget).get("page"));
    const next = Math.min(totalPages, Math.max(1, Number.isFinite(value) ? Math.trunc(value) : 1));
    if (next === page) return;
    go(href(next), message(next));
  };

  return (
    <nav className="admin-pagination" aria-label="Paginasi galeri" aria-busy={pending}>
      {page > 1 ? (
        <Link
          className="admin-pagination__step"
          href={href(page - 1)}
          rel="prev"
          onClick={follow(page - 1)}
        >
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
            href={href(item)}
            aria-current={item === page ? "page" : undefined}
            onClick={follow(item)}
          >
            {item}
          </Link>
        ),
      )}

      {page < totalPages ? (
        <Link
          className="admin-pagination__step"
          href={href(page + 1)}
          rel="next"
          onClick={follow(page + 1)}
        >
          Berikutnya ›
        </Link>
      ) : (
        <span className="admin-pagination__step" aria-disabled="true">
          Berikutnya ›
        </span>
      )}

      {/* Form GET biasa: loncat halaman tetap jalan tanpa JavaScript. */}
      <form className="admin-pagination__jump" method="get" onSubmit={jump}>
        {term ? <input type="hidden" name="q" value={term} /> : null}
        {per !== DEFAULT_PER ? <input type="hidden" name="per" value={per} /> : null}
        <label className="admin-pagination__jump-label">
          Ke halaman
          <input
            key={page}
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
  );
}
