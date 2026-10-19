import Link from "next/link";

import { requireSessionUser } from "@/lib/auth";
import { normalizeBio } from "@/lib/bio";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function SosmedListPage() {
  await requireSessionUser();

  const pages = await prisma.htmlPage.findMany({
    where: { scope: "sosmed" },
    orderBy: [{ order: "asc" }, { title: "asc" }],
  });

  return (
    <>
      <header className="admin-page-head">
        <div>
          <h1>Sosmed</h1>
          <p className="admin-head__sub">
            {pages.length} halaman link-bio. Dirender native di /bio/&lt;slug&gt; dari data
            terstruktur; tidak muncul sebagai kartu di beranda/kategori.
          </p>
        </div>
        <Link className="admin-btn admin-btn--primary" href="/adm-cms-hb/sosmed/baru">
          Halaman baru
        </Link>
      </header>

      {pages.length === 0 ? (
        <p className="admin-empty">
          Belum ada halaman link-bio. Susun halaman pertama lewat &quot;Halaman baru&quot;.
        </p>
      ) : (
        <ul className="admin-list">
          {pages.map((page) => {
            const bio = normalizeBio(page.bio);
            return (
              <li key={page.id} className="admin-list__row">
                <div className="admin-list__main">
                  <Link className="admin-list__title" href={`/adm-cms-hb/sosmed/${page.id}`}>
                    {page.title}
                  </Link>
                  <p className="admin-list__meta">
                    <code>/bio/{page.slug}</code> · {bio.openTrips.length} open trip ·{" "}
                    {bio.packages.length} paket · {bio.gallery.length} foto
                  </p>
                </div>

                <div className="admin-list__flags">
                  {!page.isPublished ? <span className="admin-flag">Draft</span> : null}
                </div>

                <div className="admin-list__actions">
                  <a
                    className="admin-btn admin-btn--small admin-btn--ghost"
                    href={`/bio/${page.slug}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Lihat
                  </a>
                  <Link className="admin-btn admin-btn--small" href={`/adm-cms-hb/sosmed/${page.id}`}>
                    Ubah
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
