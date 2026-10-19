"use client";

import type { MouseEvent } from "react";

/**
 * Tombol sekunder hero yang menggulir halus ke section tujuan.
 *
 * `href` sengaja tetap berupa anchor (`#itinerary`) supaya markup-nya identik
 * dengan legacy (audit markup tetap cocok) dan tetap berfungsi saat JS mati.
 * Saat JS aktif, klik dicegat dan digulir dengan animasi — jarak dari header
 * sticky diatur oleh `scroll-margin-top` pada `.section`, bukan di sini.
 */
export function HeroSecondaryLink({ href, children }: { href: string; children: string }) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    const id = href.startsWith("#") ? href.slice(1) : "";
    if (!id) return;

    const target = document.getElementById(id);
    if (!target) return;

    event.preventDefault();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    // Perbarui hash tanpa memicu lompatan lagi.
    history.replaceState(null, "", href);
  }

  return (
    <a className="btn btn-ghost" href={href} onClick={handleClick}>
      {children}
    </a>
  );
}