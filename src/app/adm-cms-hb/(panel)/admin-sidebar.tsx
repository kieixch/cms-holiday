"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { LogoSvg } from "@/components/site/logo";
import { logoutAction } from "../login/actions";

type Props = {
  user: { name: string; email: string };
};

type NavItem = { href: string; label: string; icon: ReactNode };

function NavIcon({ children }: { children: ReactNode }) {
  return (
    <svg className="admin-nav__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

const NAV_ITEMS: NavItem[] = [
  {
    href: "/adm-cms-hb",
    label: "Ringkasan",
    icon: (
      <NavIcon>
        <rect x="3" y="3" width="8" height="8" rx="2" />
        <rect x="13" y="3" width="8" height="8" rx="2" />
        <rect x="3" y="13" width="8" height="8" rx="2" />
        <rect x="13" y="13" width="8" height="8" rx="2" />
      </NavIcon>
    ),
  },
  {
    href: "/adm-cms-hb/paket",
    label: "Paket",
    icon: (
      <NavIcon>
        <path d="M20 7l-8 4-8-4m16 0l-8-4-8 4m16 0v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </NavIcon>
    ),
  },
  {
    href: "/adm-cms-hb/kategori",
    label: "Kategori",
    icon: (
      <NavIcon>
        <path d="M4 6h16M4 12h16M4 18h10" />
      </NavIcon>
    ),
  },
  {
    href: "/adm-cms-hb/gallery",
    label: "Galeri",
    icon: (
      <NavIcon>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="8.5" cy="9.5" r="1.5" />
        <path d="M21 15l-5-5L5 21" />
      </NavIcon>
    ),
  },
  {
    href: "/adm-cms-hb/halaman",
    label: "Halaman Custom",
    icon: (
      <NavIcon>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
      </NavIcon>
    ),
  },
  {
    href: "/adm-cms-hb/sosmed",
    label: "Sosmed",
    icon: (
      <NavIcon>
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <path d="M8.59 13.51l6.83 3.98M15.41 6.51L8.59 10.49" />
      </NavIcon>
    ),
  },
  {
    href: "/adm-cms-hb/pengaturan",
    label: "Pengaturan",
    icon: (
      <NavIcon>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .3 1.7 1.7 0 0 0-.82 1.46V21a2 2 0 0 1-4 0v-.09a1.7 1.7 0 0 0-.67-1.31 1.7 1.7 0 0 0-1-.3 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.3-1 1.7 1.7 0 0 0-1.46-.82H2.75a2 2 0 0 1 0-4h.09a1.7 1.7 0 0 0 1.31-.67 1.7 1.7 0 0 0 .3-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.3 1.7 1.7 0 0 0 .82-1.46V2.75a2 2 0 0 1 4 0v.09a1.7 1.7 0 0 0 .67 1.31 1.7 1.7 0 0 0 1 .3 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 .3 1 1.7 1.7 0 0 0 1.46.82h.09a2 2 0 0 1 0 4h-.09a1.7 1.7 0 0 0-1.31.67 1.7 1.7 0 0 0-.3 1z" />
      </NavIcon>
    ),
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/adm-cms-hb") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

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
  const pathname = usePathname();
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
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={close}
                className={active ? "is-active" : undefined}
                aria-current={active ? "page" : undefined}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            );
          })}
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