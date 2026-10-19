import type { ReactNode } from "react";
import Link from "next/link";
import { BrandLogoSvg } from "./logo";
import { MenuToggle } from "./menu-toggle";
import { PageNavigator } from "./page-navigator";
import { ScrollReveal } from "./scroll-reveal";
import { SiteFooter, StickyWa, type SiteFooterData } from "./site-footer";
import { waButtonHref, composeWaMessage } from "@/lib/wa";

export type PublicShellProps = {
  /** Modifier CSS: home | category | opentrip | package. */
  variant: "home" | "category" | "opentrip" | "package";
  waNumber: string;
  waMessage: string;
  /** Sapaan otomatis global yang ditempel di depan pesan WhatsApp. */
  waGreeting?: string;
  /**
   * Label tombol melayang. Kosong = label bawaan "Chat Sekarang" (lihat
   * `StickyWa` di Pengaturan admin).
   */
  stickyWaLabel?: string;
  /** Link rotator tombol melayang. Kosong = wa.me seperti biasa. */
  stickyWaLink?: string;
  nav: { slug: string; label: string }[];
  footer: SiteFooterData;
  children: ReactNode;
};

/** Logo selalu kembali ke Beranda situs ini, bukan ke URL WordPress. */
const HOME_HREF = "/";

/**
 * Kerangka satu halaman publik: wrapper `.hb2d1n`, header, isi, footer, dan
 * tombol WhatsApp melayang — persis urutan markup legacy.
 *
 * Semua halaman memakai logo SVG penuh (`brand-logo-wrap`) supaya seragam;
 * markup legacy hanya memakai emoji (`brand-logo`) di non-beranda — diabaikan
 * lewat MISSING_ALLOW di audit-markup.mjs.
 */
export function PublicShell({
  variant,
  waNumber,
  waMessage,
  waGreeting = "",
  stickyWaLabel,
  stickyWaLink,
  nav,
  footer,
  children,
}: PublicShellProps) {
  const isHome = variant === "home";
  const stickyMessage = composeWaMessage(waGreeting, waMessage);

  return (
    <div className={`hb2d1n hb2d1n--${variant}`}>
      <header className="site-header">
        <div className="header-inner">
          <BrandLogoSvg href={HOME_HREF} tone="dark" />
          <nav className="main-nav" id="hbNav">
            {nav.map((item) => (
              <Link key={item.slug} href={`/${item.slug}/`}>
                {item.label}
              </Link>
            ))}
          </nav>
          <MenuToggle />
        </div>
      </header>

      {children}

      <SiteFooter data={footer} showLogo={isHome} />
      <StickyWa
        href={waButtonHref(stickyWaLink, waNumber, stickyMessage)}
        label={stickyWaLabel?.trim() || "Chat Sekarang"}
      />
      <ScrollReveal />
      <PageNavigator />
    </div>
  );
}
