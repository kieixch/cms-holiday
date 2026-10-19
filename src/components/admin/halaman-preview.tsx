"use client";

import { useEffect, useMemo, useState } from "react";

import { PageCardGrid, type PageCardData } from "@/components/site/page-cards";
import { PublicShell } from "@/components/site/public-shell";
import type { ShellData } from "@/components/site/views";
import { injectBackHomeButton } from "@/lib/halaman-back-button";

/**
 * Pratinjau dokumen HTML untuk editor `/admin/halaman`.
 *
 * Isi textarea dirender lewat iframe `data:text/html` (bukan `srcdoc`),
 * karena `about:srcdoc` mewarisi CSP halaman admin yang ketat — stylesheet,
 * font, dan skrip eksternal yang ditempel admin akan diblokir dan
 * pratinjau jadi tidak jujur. Dokumen `data:` berdiri sendiri tanpa CSP,
 * sama seperti kelonggaran yang diberikan ke route `/halaman/*`.
 *
 * `sandbox="allow-scripts"`: skrip dalam dokumen tetap jalan supaya
 * dokumen yang bergantung pada JS tidak tampil mati, tapi opasitas origin
 * sandbox menghalanginya menyentuh sesi admin, membuka form, atau
 * menavigasi tab induk. Ini memang berbeda dengan versi publik (yang
 * same-origin dengan situs); pratinjau adalah tampilan, bukan tiruan
 * keamanannya.
 *
 * Render ditunda 300ms sejak ketikan terakhir supaya iframe tidak reload
 * di tiap huruf.
 */
export function HalamanDocPreview({
  html,
  slug,
  basePath = "/halaman",
}: {
  html: string;
  slug: string;
  basePath?: string;
}) {
  const [settled, setSettled] = useState(html);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(html), 300);
    return () => clearTimeout(timer);
  }, [html]);

  const src = useMemo(() => {
    if (settled.trim() === "") return null;
    // Sama seperti route publik: tombol "kembali ke beranda" disuntikkan ke
    // dokumen, jadi pratinjau menunjukkan hasil akhir yang identik.
    return `data:text/html;charset=utf-8,${encodeURIComponent(injectBackHomeButton(settled))}`;
  }, [settled]);

  return (
    <div className="hp-doc">
      <div className="hp-doc__chrome">
        <span className="hp-doc__dots" aria-hidden="true">
          ● ● ●
        </span>
        <span className="hp-doc__url">{basePath}/{slug || "…"}</span>
      </div>
      {src ? (
        <iframe
          title={`Pratinjau dokumen${slug ? ` ${basePath}/${slug}` : ""}`}
          className="hp-doc__frame"
          src={src}
          sandbox="allow-scripts"
        />
      ) : (
        <p className="hp-doc__empty">
          Tempel dokumen HTML di panel kiri — pratinjaunya langsung tampil di sini.
        </p>
      )}
    </div>
  );
}

/**
 * Pratinjau kartu tautan di konteks beranda sungguhan.
 *
 * Sengaja memakai `<PublicShell>` yang sama dengan route publik: kartu
 * dirender di dalam `.hb2d1n` lengkap dengan header, footer, dan tombol
 * WhatsApp melayang, jadi jarak, lebar container, dan warna latarnya persis
 * seperti saat kartu tampil di beranda. Tanpa shell itu, `.section.container`
 * tidak punya gaya (legacy.css di-scope di bawah `.hb2d1n`) dan pratinjau
 * tampil sebagai tumpukan teks polos.
 *
 * Saat kartu tidak akan tampil di situs (belum tayang atau belum ada
 * penempatan), yang dirender keterangan — sama seperti query route publik
 * yang menyaring baris tersebut.
 */
export function HalamanCardPreview({
  shell,
  card,
  visible,
  reason,
}: {
  shell: ShellData;
  card: PageCardData;
  visible: boolean;
  reason: "unpublished" | "unplaced";
}) {
  if (!visible) {
    return (
<p className="hp-note">
        {reason === "unpublished"
          ? "Halaman belum ditayang — kartu tidak muncul di situs. Centang “Tayang” untuk menyalakannya."
          : "Belum ada penempatan — centang “Tampilkan kartu di beranda”, atau pilih minimal satu kategori pada dropdown “Tampilkan kartu di kategori”."}
      </p>
    );
  }

  return (
    <PublicShell
      variant={shell.variant}
      waNumber={shell.waNumber}
      waMessage={shell.waMessage}
      waGreeting={shell.waGreeting}
      stickyWaLabel={shell.stickyWaLabel}
      stickyWaLink={shell.stickyWaLink}
      nav={shell.nav}
      footer={shell.footer}
    >
      <section data-reveal className="section container" id="halaman">
        <PageCardGrid pages={[card]} />
      </section>
    </PublicShell>
  );
}
