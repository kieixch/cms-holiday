import { LogoSvg } from "./logo";
import { mailtoHref, safeHref } from "@/lib/wa";

/** Ikon brand Instagram (garis), dipakai pada tautan footer. */
function InstagramIcon() {
  return (
    <svg
      className="hbgl-social-ico"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="2" width="20" height="20" rx="5.5" />
      <circle cx="12" cy="12" r="4.2" />
      <line x1="17.6" y1="6.4" x2="17.61" y2="6.4" />
    </svg>
  );
}

/** Ikon brand TikTok (siluet). */
function TiktokIcon() {
  return (
    <svg className="hbgl-social-ico" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.53.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  );
}

/** Ikon amplop (garis) untuk tautan email. */
function EmailIcon() {
  return (
    <svg
      className="hbgl-social-ico"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="4" width="20" height="16" rx="3.5" />
      <path d="m22 7-9.5 6a1 1 0 0 1-.96 0L2 7" />
    </svg>
  );
}

export type SiteFooterData = {
  siteUrl: string;
  email: string;
  instagram: string;
  tiktok: string;
  footerText: string;
  footerHeading: string;
  copyrightText: string;
  footerMadeWith: string;
  footerLocation: string;
  footerHeart: string;
};

/**
 * Footer publik.
 *
 * Hanya beranda yang memakai blok logo SVG (`footer-logo-wrap`); halaman lain
 * memakai judul teks `footerHeading`. Karena itu penanda logo lewat prop
 * `showLogo`, bukan lewat pengaturan global.
 */
export function SiteFooter({
  data,
  showLogo,
}: {
  data: SiteFooterData;
  showLogo: boolean;
}) {

  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-top">
          <div>
            {showLogo ? (
              <div className="footer-logo-wrap">
                <LogoSvg />
              </div>
            ) : (
              <h3>{data.footerHeading}</h3>
            )}
            <p>{data.footerText}</p>
          </div>
          <div className="footer-social">
            <a href={safeHref(data.instagram)} target="_blank" rel="noopener">
              <InstagramIcon />
              Instagram
            </a>
            <a href={safeHref(data.tiktok)} target="_blank" rel="noopener">
              <TiktokIcon />
              Tiktok
            </a>
            <a href={safeHref(mailtoHref(data.email))}>
              <EmailIcon />
              Email
            </a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>{data.copyrightText}</span>
          <span>
            {data.footerMadeWith} <span className="heart">{data.footerHeart}</span>{" "}
            {data.footerLocation}
          </span>
        </div>
      </div>
    </footer>
  );
}

/** Tombol WhatsApp melayang di kanan bawah, ada di semua halaman. */
export function StickyWa({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} className="sticky-wa" target="_blank" rel="noopener">
      💬 <span className="label">{label}</span>
    </a>
  );
}
