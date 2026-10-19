import Link from "next/link";

import { requireSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HalamanListPage() {
  await requireSessionUser();

  const pages = await prisma.htmlPage.findMany({
    where: { scope: "page" },
    orderBy: [{ order: "asc" }, { title: "asc" }],
  });

  return (
    <>
      <header className="admin-page-head">
        <div>
          <h1>Halaman Custom</h1>
          <p className="admin-head__sub">
            {pages.length} halaman HTML. Dokumen dirender apa adanya di /halaman/&lt;slug&gt;,
            di luar layout situs.
          </p>
        </div>
        <Link className="admin-btn admin-btn--primary" href="/adm-cms-hb/halaman/baru">
          Halaman baru
        </Link>
      </header>

      {pages.length === 0 ? (
        <p className="admin-empty">
          Belum ada halaman. Tempel dokumen HTML pertama lewat &quot;Halaman baru&quot;.
        </p>
      ) : (
        <ul className="admin-list">
          {pages.map((page) => (
            <li key={page.id} className="admin-list__row">
              <div className="admin-list__main">
                <Link className="admin-list__title" href={`/adm-cms-hb/halaman/${page.id}`}>
                  {page.title}
                </Link>
                <p className="admin-list__meta">
                  <code>/halaman/{page.slug}</code> · {page.html.length.toLocaleString("id-ID")}{" "}
                  karakter
                </p>
              </div>

              <div className="admin-list__flags">
                {!page.isPublished ? <span className="admin-flag">Draft</span> : null}
                {page.showOnHome ? <span className="admin-flag">Beranda</span> : null}
                {page.categorySlugs.length > 0 ? (
                  <span className="admin-flag">{page.categorySlugs.length} kategori</span>
                ) : null}
              </div>

              <div className="admin-list__actions">
                <a
                  className="admin-btn admin-btn--small admin-btn--ghost"
                  href={`/halaman/${page.slug}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Lihat
                </a>
                <Link className="admin-btn admin-btn--small" href={`/adm-cms-hb/halaman/${page.id}`}>
                  Ubah
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
