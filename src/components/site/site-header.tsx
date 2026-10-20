import { BrandLogoSvg } from "./logo";
import { MenuToggle } from "./menu-toggle";

type SiteHeaderProps = {
  nav: { slug: string; label: string }[];
};

/**
 * Header publik.
 *
 * Menyusul keputusan "logo konsisten seperti beranda", semua halaman kini
 * memakai logo SVG penuh (`brand-logo-wrap`) — termasuk komponen ini.
 */
export function SiteHeader({ nav }: SiteHeaderProps) {
  return (
    <header className="site-header">
      <div className="header-inner">
        <BrandLogoSvg href="/" tone="dark" />
        <nav className="main-nav" id="hbNav">
          {nav.map((item) => (
            <a key={item.slug} href={`/${item.slug}/`}>
              {/* Span label: di popup menu hanya teks yang mengecil-besar
                  saat hover (zoom), sementara area klik tetap selebar menu. */}
              <span className="main-nav__label">{item.label}</span>
            </a>
          ))}
        </nav>
        <MenuToggle />
      </div>
    </header>
  );
}
