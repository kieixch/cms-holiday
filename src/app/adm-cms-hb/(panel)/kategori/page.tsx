import Link from "next/link";

import { requireSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CategoryListPage() {
  await requireSessionUser();

  const categories = await prisma.category.findMany({
    orderBy: [{ order: "asc" }, { name: "asc" }],
    include: { _count: { select: { packages: true, benefits: true } } },
  });

  return (
    <>
      <header className="admin-page-head">
        <div>
          <h1>Kategori</h1>
          <p className="admin-head__sub">
            {categories.length} kategori. Menghapus kategori juga menghapus paket di dalamnya.
          </p>
        </div>
        <Link className="admin-btn admin-btn--primary" href="/adm-cms-hb/kategori/baru">
          Kategori baru
        </Link>
      </header>

      <ul className="admin-list">
        <li className="admin-list__row">
          <div className="admin-list__main">
            <Link className="admin-list__title" href="/adm-cms-hb/kategori/beranda">
              Beranda
            </Link>
            <p className="admin-list__meta">
              Hero, tipe trip, paket favorit, keunggulan, testimoni, dan ajakan booking.
            </p>
          </div>

          <div className="admin-list__actions">
            <a className="admin-btn admin-btn--small admin-btn--ghost" href="/" target="_blank" rel="noreferrer">
              Lihat
            </a>
            <Link className="admin-btn admin-btn--small" href="/adm-cms-hb/kategori/beranda">
              Ubah
            </Link>
          </div>
        </li>
      </ul>

      <h2 className="admin-list__heading">Kategori</h2>

      {categories.length === 0 ? (
        <p className="admin-empty">Belum ada kategori. Buat satu untuk mulai.</p>
      ) : (
        <ul className="admin-list">
          {categories.map((category) => (
            <li key={category.id} className="admin-list__row">
              <div className="admin-list__main">
                <Link className="admin-list__title" href={`/adm-cms-hb/kategori/${category.slug}`}>
                  {category.name}
                </Link>
                <p className="admin-list__meta">
                  <code>/{category.slug}</code> · {category.kind === "OPEN_TRIP" ? "Open Trip" : "Private"}{" "}
                  · {category._count.packages} paket · {category._count.benefits} keunggulan
                  {category.duration ? ` · ${category.duration}` : ""}
                </p>
              </div>

              <div className="admin-list__flags">
                {!category.isPublished ? <span className="admin-flag">Draft</span> : null}
                {category.showInNav ? <span className="admin-flag">Di menu</span> : null}
              </div>

              <div className="admin-list__actions">
                <a
                  className="admin-btn admin-btn--small admin-btn--ghost"
                  href={`/${category.slug}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Lihat
                </a>
                <Link className="admin-btn admin-btn--small" href={`/adm-cms-hb/kategori/${category.slug}`}>
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
