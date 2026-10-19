import Link from "next/link";

import { NewPackageButton } from "@/components/admin/new-package-button";
import { requireSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Daftar semua paket, dikelompokkan per kategori.
 *
 * Kalau paket Open Trip tidak ditampilkan di sini, management detail yang
 * baru dibuat tidak akan pernah dipakai — daftar ini sengaja membaca semua
 * `Package`, termasuk yang `hasDetailPage`-nya masih `false`.
 */
export default async function PackageListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireSessionUser();

  const { q } = await searchParams;
  const query = (q ?? "").trim();

  /**
   * Kategori diambil terpisah dari hasil pencarian.
   *
   * Popup "Paket Baru" harus menawarkan seluruh kategori yang ada, bukan hanya
   * yang kebetulan punya paket yang cocok dengan kata kunci — termasuk kategori
   * yang belum punya paket sama sekali.
   */
  const [packages, categories] = await Promise.all([
    prisma.package.findMany({
      where: query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { slug: { contains: query, mode: "insensitive" } },
            ],
          }
        : undefined,
      select: {
        id: true,
        slug: true,
        name: true,
        isPublished: true,
        hasDetailPage: true,
        showOnHome: true,
        order: true,
        category: { select: { slug: true, navLabel: true, kind: true, order: true } },
        pricing: { select: { _count: { select: { rows: true } } } },
        _count: { select: { itinerary: true, facilities: true, gallery: true } },
      },
      orderBy: [
        { category: { order: "asc" } },
        { category: { name: "asc" } },
        { order: "asc" },
        { name: "asc" },
      ],
    }),
    prisma.category.findMany({
      select: {
        slug: true,
        navLabel: true,
        name: true,
        kind: true,
        _count: { select: { packages: true } },
      },
      orderBy: [{ order: "asc" }, { name: "asc" }],
    }),
  ]);

  const byCategory = new Map<string, typeof packages>();
  for (const pkg of packages) {
    const key = pkg.category.slug;
    const bucket = byCategory.get(key);
    if (bucket) bucket.push(pkg);
    else byCategory.set(key, [pkg]);
  }

  return (
    <>
      <header className="admin-page-head">
        <div>
          <h1>Paket</h1>
          <p className="admin-head__sub">
            {packages.length} paket. Paket tanpa halaman detail tetap bisa disunting di sini.
          </p>
        </div>
        <NewPackageButton
          categories={categories.map((category) => ({
            slug: category.slug,
            label: category.navLabel || category.name || category.slug,
            kind: category.kind,
            packages: category._count.packages,
          }))}
        />
      </header>

      <form className="admin-search">
        <input
          className="admin-input"
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Cari nama atau slug paket…"
        />
        <button className="admin-btn" type="submit">
          Cari
        </button>
        {query ? (
          <Link className="admin-btn admin-btn--ghost" href="/adm-cms-hb/paket">
            Reset
          </Link>
        ) : null}
      </form>

      {packages.length === 0 ? (
        <p className="admin-empty">
          {query ? `Tidak ada paket yang cocok dengan "${query}".` : "Belum ada paket."}
        </p>
      ) : (
        [...byCategory.entries()].map(([categorySlug, group]) => (
          <section className="admin-group" key={categorySlug}>
            <header className="admin-group__head">
              <h2>
                <Link href={`/adm-cms-hb/kategori/${categorySlug}`}>{group[0].category.navLabel}</Link>
              </h2>
              <span className="admin-list__meta">
                <code>/{categorySlug}</code> · {group.length} paket
              </span>
            </header>

            <ul className="admin-list">
              {group.map((pkg) => (
                <li key={pkg.id} className="admin-list__row">
                  <div className="admin-list__main">
                    <Link className="admin-list__title" href={`/adm-cms-hb/paket/${pkg.slug}`}>
                      {pkg.name}
                    </Link>
                    <p className="admin-list__meta">
                      <code>/{pkg.slug}</code> · {pkg._count.itinerary} hari itinerary ·{" "}
                      {pkg._count.facilities} grup fasilitas
                      {pkg._count.gallery > 0 ? ` · ${pkg._count.gallery} foto` : ""}
                      {pkg.pricing && pkg.pricing._count.rows > 0
                        ? ` · ${pkg.pricing._count.rows} baris harga`
                        : ""}
                    </p>
                  </div>

                  <div className="admin-list__flags">
                    {!pkg.isPublished ? <span className="admin-flag">Draft</span> : null}
                    {pkg.hasDetailPage ? null : <span className="admin-flag">Tanpa detail</span>}
                    {pkg.showOnHome ? <span className="admin-flag">Di beranda</span> : null}
                  </div>

                  <div className="admin-list__actions">
                    {pkg.isPublished ? (
                      <a
                        className="admin-btn admin-btn--small admin-btn--ghost"
                        href={`/${pkg.slug}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Lihat
                      </a>
                    ) : null}
                    <Link className="admin-btn admin-btn--small" href={`/adm-cms-hb/paket/${pkg.slug}`}>
                      Ubah
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </>
  );
}