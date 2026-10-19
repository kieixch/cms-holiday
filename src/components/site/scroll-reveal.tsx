"use client";

import { useEffect } from "react";

/**
 * Pendukung animasi kustom (desain baru, bebas audit).
 *
 * - Menambahkan class `hbgl-js` pada <html> → CSS memakai `html.hbgl-js`
 *   untuk mengaktifkan state tersembunyi elemen `[data-reveal]`.
 *   Tanpa JS tidak ada yang disembunyikan (progressive enhancement).
 * - IntersectionObserver menambahkan `hbgl-inview` saat elemen mendekati
 *   viewport → transisi fade/slide.
 * - MutationObserver mengamati `[data-reveal]` yang muncul **setelah** mount
 *   (mis. seksi yang dimatikan lalu dinyalakan lagi di pratinjau live, atau
 *   konten yang di-refresh). Tanpa ini, elemen baru tidak pernah di-observe
 *   sehingga tetap tersembunyi selama `html.hbgl-js` aktif.
 * - Scroll listener menambahkan `hbgl-scrolled` pada <html> untuk shift
 *   navbar (border + blur saat menggulir).
 */
export function ScrollReveal() {
  useEffect(() => {
    const root = document.documentElement;

    const isScroll = () => root.classList.toggle("hbgl-scrolled", window.scrollY > 8);
    isScroll();
    window.addEventListener("scroll", isScroll, { passive: true });

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const instant = reduce || typeof IntersectionObserver === "undefined";

    root.classList.add("hbgl-js");

    const show = (el: Element) => el.classList.add("hbgl-inview");

    const io = instant
      ? null
      : new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (!entry.isIntersecting) continue;
              show(entry.target);
              io!.unobserve(entry.target);
            }
          },
          // Threshold 0 (bukan 0.12): seksi yang tinggi — mis. listing Open Trip —
          // di viewport sempit tidak pernah mencapai 12% rasio intersection, jadi
          // elemennya tidak pernah dapat `hbgl-inview` dan tetap tersembunyi.
          { threshold: 0, rootMargin: "0px 0px -8% 0px" },
        );

    const observe = (el: Element) => {
      if (el.classList.contains("hbgl-inview")) return;
      if (io) io.observe(el);
      else show(el);
    };

    const scan = (scope: ParentNode) =>
      scope.querySelectorAll("[data-reveal]").forEach((el) => observe(el));

    scan(document);

    const mo = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node.matches("[data-reveal]")) observe(node);
          scan(node);
        });
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      io?.disconnect();
      mo.disconnect();
      window.removeEventListener("scroll", isScroll);
    };
  }, []);

  return null;
}