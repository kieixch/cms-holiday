import Link from "next/link";

export type InactivePackageInfo = {
  slug: string;
  name: string;
  isPublished: boolean;
  hasDetailPage: boolean;
};

/**
 * Pemberitahuan yang menggantikan 404 ketika URL paket ada di database tapi
 * halamannya belum aktif (masih draft, atau belum diaktifkan "Punya halaman
 * detail").
 *
 * Tampilannya memakai kelas legacy yang sudah ada (`.section`, `.note-box`,
 * `.btn`) supaya seragam dengan situs dan tidak menambah aturan visual baru.
 * Tombolnya mengarah ke panel admin, karena halaman ini biasanya muncul saat
 * admin membuka tautan paket yang belum diterbitkan.
 */
export function InactivePackageNotice({
  pkg,
}: {
  pkg: { slug: string; name: string; isPublished: boolean; hasDetailPage: boolean };
}) {
  const reason =
    !pkg.isPublished && !pkg.hasDetailPage
      ? "Paket ini masih draft dan belum punya halaman detail."
      : !pkg.isPublished
        ? "Paket ini masih draft, jadi belum diterbitkan ke situs publik."
        : "Paket ini belum diaktifkan “Punya halaman detail”, jadi belum punya URL publik.";

  return (
    <section className="section">
      <div className="container">
        <div className="inactive-notice">
          <div className="note-box" role="alert">
            <span className="note-icon" aria-hidden="true">
              🔒
            </span>
            <div>
              <strong>Halaman belum aktif.</strong> {reason}
            </div>
          </div>

          <h1 className="section-title">
            Paket “{pkg.name}” belum bisa dilihat
          </h1>
          <p className="section-desc">
            Aktifkan halaman publiknya di panel admin, lalu buka lagi tautan ini.
          </p>

          <div className="inactive-notice__actions">
            <Link className="btn btn-primary" href={`/admin/paket/${pkg.slug}`}>
              Kembali ke panel admin
            </Link>
            <Link className="btn btn-ghost" href="/">
              Ke beranda
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}