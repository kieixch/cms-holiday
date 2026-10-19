import Link from "next/link";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  OPEN_TRIP: "Open Trip",
  PRIVATE_TRIP: "Private Trip",
};

/** Persentase aman saat totalnya nol. */
function pct(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

/** Ukuran berkas yang bisa dibaca, mis. "12,4 MB". */
function formatBytes(bytes: number) {
  if (bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

/**
 * Ringkasan isi situs.
 *
 * Tiga kartu di atas sengaja dibuat kaya (ikon, rasio terbit, potongan aset),
 * bukan hanya angka telanjang, supaya kondisi konten kelihatan sekilas tanpa
 * harus membuka tiap daftar. Kartu-kartu di bawahnya menyorot hal yang perlu
 * ditindaklanjuti.
 */
export default async function AdminDashboardPage() {
  // Guard eksplisit, bukan hanya andalkan layout panel.
  await requireAdmin();
  const [
    categoryTotal,
    categoryPublished,
    packageTotal,
    packagePublished,
    packageFeatured,
    packageOnHome,
    assetTotal,
    assetSizes,
    recentAssets,
    categories,
    allPackages,
  ] = await Promise.all([
    prisma.category.count(),
    prisma.category.count({ where: { isPublished: true } }),
    prisma.package.count(),
    prisma.package.count({ where: { isPublished: true } }),
    prisma.package.count({ where: { isPublished: true, isFeatured: true } }),
    prisma.package.count({ where: { isPublished: true, showOnHome: true } }),
    prisma.mediaAsset.count(),
    prisma.mediaAsset.aggregate({ _sum: { size: true } }),
    prisma.mediaAsset.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, url: true, alt: true, filename: true },
    }),
    prisma.category.findMany({
      orderBy: { order: "asc" },
      select: {
        slug: true,
        name: true,
        kind: true,
        isPublished: true,
        _count: { select: { packages: true } },
      },
    }),
    prisma.package.findMany({
      orderBy: [{ category: { order: "asc" } }, { order: "asc" }],
      select: {
        slug: true,
        name: true,
        isPublished: true,
        cardImage: true,
        cardLoc: true,
        cardTag: true,
        cardHighlight: true,
        cardPriceValue: true,
        category: { select: { name: true } },
        pricing: { select: { id: true } },
        _count: {
          select: {
            itinerary: true,
            facilities: true,
            gallery: true,
            notes: true,
            cardDays: true,
            cardPrices: true,
            cardFacilities: true,
          },
        },
      },
    }),
  ]);

  /**
   * Paket "hero only": semua judul hero terisi (memang wajib), tapi tidak ada
   * isi lain sama sekali — tanpa itinerary, fasilitas, harga, galeri, catatan,
   * bahkan data kartu. Paket seperti ini tayang kosong dan perlu dilengkapi.
   */
  const isIncomplete = (pkg: (typeof allPackages)[number]) => {
    const c = pkg._count;
    return !(
      c.itinerary > 0 ||
      c.facilities > 0 ||
      c.gallery > 0 ||
      c.notes > 0 ||
      c.cardDays > 0 ||
      c.cardPrices > 0 ||
      c.cardFacilities > 0 ||
      pkg.pricing ||
      pkg.cardImage ||
      pkg.cardLoc ||
      pkg.cardTag ||
      pkg.cardHighlight ||
      pkg.cardPriceValue
    );
  };

  const incompleteCount = allPackages.filter(isIncomplete).length;
  const troublePackages = allPackages
    .filter((pkg) => !pkg.isPublished || !pkg.cardImage || isIncomplete(pkg))
    // Yang belum lengkap ditaruh paling atas supaya langsung terlihat.
    .sort((a, b) => Number(isIncomplete(b)) - Number(isIncomplete(a)))
    .slice(0, 6);
  const troubleCount = allPackages.filter(
    (pkg) => !pkg.isPublished || !pkg.cardImage || isIncomplete(pkg),
  ).length;

  const assetBytes = assetSizes._sum.size ?? 0;
  const maxCategoryPackages = Math.max(1, ...categories.map((c) => c._count.packages));

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Ringkasan</h1>
          <p>Kondisi isi situs saat ini.</p>
        </div>
        <a className="admin-btn admin-btn--ghost" href="/" target="_blank" rel="noreferrer">
          Lihat situs ↗
        </a>
      </div>

      <div className="admin-stat-grid">
        <Link className="admin-card admin-stat admin-stat--link" href="/adm-cms-hb/kategori">
          <span className="admin-stat-icon" aria-hidden>
            🗂️
          </span>
          <span className="admin-stat-value">{categoryTotal}</span>
          <span className="admin-stat-label">Kategori</span>
          <span className="admin-stat-sub">
            {categoryPublished} terbit · {categoryTotal - categoryPublished} draft
          </span>
          <span className="admin-stat-bar" aria-hidden>
            <span style={{ width: `${pct(categoryPublished, categoryTotal)}%` }} />
          </span>
          <span className="admin-stat-foot">{packageTotal} paket di dalamnya</span>
        </Link>

        <Link className="admin-card admin-stat admin-stat--link" href="/adm-cms-hb/paket">
          <span className="admin-stat-icon" aria-hidden>
            📦
          </span>
          <span className="admin-stat-value">{packageTotal}</span>
          <span className="admin-stat-label">Paket trip</span>
          <span className="admin-stat-sub">
            {packagePublished} terbit · {packageTotal - packagePublished} draft
          </span>
          <span className="admin-stat-bar" aria-hidden>
            <span style={{ width: `${pct(packagePublished, packageTotal)}%` }} />
          </span>
          <span className="admin-stat-foot">
            {packageFeatured} unggulan · {packageOnHome} di beranda
          </span>
        </Link>

        <Link className="admin-card admin-stat admin-stat--link" href="/adm-cms-hb/gallery">
          <span className="admin-stat-icon" aria-hidden>
            🖼️
          </span>
          <span className="admin-stat-value">{assetTotal}</span>
          <span className="admin-stat-label">Media</span>
          <span className="admin-stat-sub">{formatBytes(assetBytes)} terpakai di penyimpanan</span>
          <span className="admin-stat-strip" aria-hidden>
            {recentAssets.length > 0 ? (
              recentAssets.slice(0, 4).map((asset) => (
                // Thumbnail kecil dari aset terbaru — pengganti "bar" supaya
                // kartu ini tetap visual, bukan sekadar angka.
                // eslint-disable-next-line @next/next/no-img-element
                <img key={asset.id} src={asset.url} alt="" loading="lazy" />
              ))
            ) : (
              <span className="admin-stat-strip__empty">Belum ada aset</span>
            )}
          </span>
          <span className="admin-stat-foot">
            {recentAssets.length > 0 ? `Terbaru: ${recentAssets[0].filename}` : "Galeri masih kosong"}
          </span>
        </Link>
      </div>

      <div className="admin-dash-grid">
        <section className="admin-card">
          <h2 className="admin-card-title">Isi per kategori</h2>
          <p className="admin-card-text">
            Sebaran paket dan status tayang tiap halaman kategori.
          </p>
          <ul className="admin-dash-list">
            {categories.map((category) => {
              const published = category.isPublished;
              return (
                <li className="admin-dash-row" key={category.slug}>
                  <div className="admin-dash-row__main">
                    <Link className="admin-dash-row__title" href={`/adm-cms-hb/kategori/${category.slug}`}>
                      {category.name}
                    </Link>
                    <span className="admin-dash-row__meta">
                      {KIND_LABEL[category.kind] ?? category.kind} · {category._count.packages} paket
                    </span>
                    <span className="admin-dash-row__bar" aria-hidden>
                      <span
                        style={{ width: `${pct(category._count.packages, maxCategoryPackages)}%` }}
                      />
                    </span>
                  </div>
                  <span className={`admin-flag ${published ? "admin-flag--ok" : ""}`}>
                    {published ? "Terbit" : "Draft"}
                  </span>
                </li>
              );
            })}
          </ul>
          <Link className="admin-btn admin-btn--small admin-btn--ghost" href="/adm-cms-hb/kategori">
            Kelola kategori
          </Link>
        </section>

        <section className="admin-card">
          <h2 className="admin-card-title">Perlu dilengkapi</h2>
          <p className="admin-card-text">
            {troubleCount === 0
              ? "Semua paket sudah punya gambar dan tayang. Mantap!"
              : incompleteCount > 0
                ? `${incompleteCount} paket masih kosong (baru terisi hero), ${troubleCount} paket perlu ditindaklanjuti.`
                : `${troubleCount} paket belum tayang atau belum punya gambar kartu.`}
          </p>
          {troublePackages.length > 0 ? (
            <ul className="admin-dash-list">
              {troublePackages.map((pkg) => (
                <li className="admin-dash-row" key={pkg.slug}>
                  <div className="admin-dash-row__main">
                    <Link className="admin-dash-row__title" href={`/adm-cms-hb/paket/${pkg.slug}`}>
                      {pkg.name}
                    </Link>
                    <span className="admin-dash-row__meta">{pkg.category.name}</span>
                  </div>
                  <span className="admin-list__flags">
                    {isIncomplete(pkg) && (
                      <span className="admin-flag admin-flag--warn">Belum lengkap</span>
                    )}
                    {!pkg.isPublished && <span className="admin-flag">Draft</span>}
                    {!pkg.cardImage && <span className="admin-flag">Tanpa gambar</span>}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          <Link className="admin-btn admin-btn--small admin-btn--ghost" href="/adm-cms-hb/paket">
            Buka daftar paket
          </Link>
        </section>

        <section className="admin-card">
          <h2 className="admin-card-title">Media terbaru</h2>
          <p className="admin-card-text">Aset yang paling baru diunggah ke galeri.</p>
          {recentAssets.length > 0 ? (
            <div className="admin-thumbrow">
              {recentAssets.map((asset) => (
                <Link className="admin-thumbrow__item" href={`/adm-cms-hb/gallery/${asset.id}`} key={asset.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={asset.url} alt={asset.alt} loading="lazy" />
                </Link>
              ))}
            </div>
          ) : (
            <p className="admin-empty admin-empty--tight">Belum ada aset di galeri.</p>
          )}
          <Link className="admin-btn admin-btn--small admin-btn--ghost" href="/adm-cms-hb/gallery">
            Buka galeri
          </Link>
        </section>

        <section className="admin-card">
          <h2 className="admin-card-title">Aksi cepat</h2>
          <p className="admin-card-text">Pintasan ke pekerjaan yang paling sering dilakukan.</p>
          <div className="admin-dash-actions">
            <Link className="admin-btn admin-btn--small" href="/adm-cms-hb/paket/baru">
              + Paket baru
            </Link>
            <Link className="admin-btn admin-btn--small" href="/adm-cms-hb/kategori/baru">
              + Kategori baru
            </Link>
            <Link className="admin-btn admin-btn--small admin-btn--ghost" href="/adm-cms-hb/kategori/beranda">
              Sunting beranda
            </Link>
            <Link className="admin-btn admin-btn--small admin-btn--ghost" href="/adm-cms-hb/gallery">
              Unggah media
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
