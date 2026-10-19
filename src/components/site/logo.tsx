/**
 * Logo Holiday Banyuwangi.
 *
 * `variant="svg"` dipakai di beranda (versi dengan tulisan), `variant="emoji"`
 * dipakai di halaman lain. Keduanya meniru markup asli legacy supaya CSS yang
 * sudah diekstrak langsung cocok tanpa penyesuaian.
 *
 * `href` sengaja diarahkan ke Beranda *situs ini*, bukan ke URL WordPress
 * seperti di markup legacy. Markup aslinya meng-hardcode
 * `https://holidaybanyuwangi.com`, sehingga klik logo di CMS ini malah
 * melempar pengunjung ke situs lama. Ditambah `TripleClickLink` sebagai
 * entry point tersembunyi ke panel admin.
 */

import { TripleClickLink } from "./triple-click-link";

export function LogoSvg({ tone = "light" }: { tone?: "light" | "dark" }) {
  return (
    <svg viewBox="0 0 340 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="0" y="0" width="120" height="120" rx="26" fill="#DDE8E1" />
      <circle cx="60" cy="48" r="24" fill="#245447" />
      <circle cx="42" cy="64" r="18" fill="#245447" />
      <circle cx="78" cy="64" r="18" fill="#245447" />
      <circle cx="50" cy="40" r="12" fill="#3F705D" opacity="0.5" />
      <rect x="56" y="80" width="8" height="24" rx="4" fill="#7B4A2D" />
      <ellipse cx="60" cy="103" rx="16" ry="5" fill="#6B3A1F" opacity="0.2" />
      <text
        x="138"
        y="62"
        fontFamily="'Baloo 2', Arial, sans-serif"
        fontWeight="800"
        fontSize="46"
        fill={tone === "light" ? "white" : "#163C32"}
        letterSpacing="-1"
      >
        holiday
      </text>
      <text
        x="140"
        y="88"
        fontFamily="'Baloo 2', Arial, sans-serif"
        fontWeight="600"
        fontSize="17"
        fill={tone === "light" ? "rgba(255,255,255,0.65)" : "#245447"}
        letterSpacing="5"
      >
        BANYUWANGI
      </text>
    </svg>
  );
}

export function BrandLogoSvg({ href, tone = "light" }: { href: string; tone?: "light" | "dark" }) {
  return (
    <TripleClickLink href={href} className="brand-logo-wrap">
      <LogoSvg tone={tone} />
    </TripleClickLink>
  );
}

export function BrandLogoEmoji({ href }: { href: string }) {
  return (
    <TripleClickLink href={href} className="brand-logo">
      <span className="logo-icon">🌳</span>
      <span className="logo-text">
        <span className="l1">Holiday</span>
        <span className="l2">Banyuwangi</span>
      </span>
    </TripleClickLink>
  );
}
