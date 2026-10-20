"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { LogoSvg } from "@/components/site/logo";
import { logoutAction } from "../login/actions";

type Props = {
  user: { name: string; email: string };
};

/**
 * Sidebar panel admin beserta tombol hamburger untuk layar sempit.
 *
 * Di layar lebar sidebar selalu tampil (lihat `.admin-shell` dua kolom).
 * Di bawah 900px ia menjadi panel geser (off-canvas): tersembunyi di luar
 * layar, lalu muncul saat tombol hamburger ditekan. Status terbuka murni
 * state client karena hanya menyangkut tata letak, bukan data.
 *
 * Karena state-nya di client, `logoutAction` (server action) diimpor langsung
 * dari modulnya — pola yang sama dengan halaman login.
 */
export function AdminSidebar({ user }: Props) {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  // Escape menutup, dan gulir latar dikunci selama panel terbuka.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  // Kembali ke layar lebar: sidebar jadi statis lagi, jadi state terbuka
  // direset supaya gulir tidak tetap terkunci.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 901px)");
    const onChange = () => {
      if (mq.matches) setOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <>
      {/*
        Navbar khusus layar sempit: logo di kiri, hamburger di kanan. Di desktop
        bar ini disembunyikan — sidebar tampil permanen dengan brand-nya sendiri.
        Sidebar tetap meluncur dari kiri seperti sebelumnya.
      */}
      <header className="admin-topbar">
        <Link
          href="/adm-cms-hb"
          className="admin-topbar__brand"
          aria-label="Holiday Banyuwangi"
          onClick={close}
        >
          <LogoSvg tone="light" />
        </Link>

        <button
          type="button"
          className="admin-menubtn"
          aria-label={open ? "Tutup menu" : "Buka menu"}
          aria-expanded={open}
          aria-controls="admin-sidebar"
          onClick={() => setOpen((value) => !value)}
        >
          <span className="admin-menubtn__bars" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>
      </header>

      <div
        className={`admin-sidebar-backdrop${open ? " is-open" : ""}`}
        onClick={close}
        aria-hidden="true"
      />

      <aside id="admin-sidebar" className={`admin-sidebar${open ? " is-open" : ""}`}>
        <div className="admin-brand" aria-label="Holiday Banyuwangi">
          {/*
            Logo sama persis dengan halaman publik (SVG penuh beranda).
            `tone="light"` supaya teks wordmark putih di sidebar hijau tua.
          */}
          <LogoSvg tone="light" />
        </div>

        <nav className="admin-nav">
          <Link href="/adm-cms-hb" onClick={close}>
            Ringkasan
          </Link>
          <Link href="/adm-cms-hb/paket" onClick={close}>
            Paket
          </Link>
          {/* Home disunting lewat menu Kategori sesuai keputusan admin: tidak
              ada entri sidebar sendiri, supaya halaman publik tidak bertambah
              satu level menu yang isinya tumpang tindih dengan Kategori. */}
          <Link href="/adm-cms-hb/kategori" onClick={close}>
            Kategori
          </Link>
          <Link href="/adm-cms-hb/gallery" onClick={close}>
            Galeri
          </Link>
          <Link href="/adm-cms-hb/halaman" onClick={close}>
            Halaman Custom
          </Link>
          <Link href="/adm-cms-hb/sosmed" onClick={close}>
            Sosmed
          </Link>
          <Link href="/adm-cms-hb/pengaturan" onClick={close}>
            Pengaturan
          </Link>
        </nav>

        <form action={logoutAction} className="admin-sidebar-foot">
          <p className="admin-user">
            <strong>{user.name}</strong>
            <span>{user.email}</span>
          </p>
          <button className="admin-btn admin-btn--ghost admin-btn--block" type="submit">
            Keluar
          </button>
        </form>
      </aside>
    </>
  );
}