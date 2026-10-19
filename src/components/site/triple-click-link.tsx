"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

/** Halaman tujuan trigger. */
const ADMIN_ENTRY = "/adm-cms-hb/login";

/** Jumlah klik beruntun untuk membuka panel admin. */
const CLICKS_REQUIRED = 3;

/**
 * Jeda sebelum navigasi normal dilakukan, dalam milidetik.
 *
 * Nilainya sengaja di bawah ambang double-click (~500ms) supaya klik tunggal
 * tetap terasa responsif. Selama jeda ini kita menunggu kemungkinan klik
 * kedua dan ketiga — tanpa jeda, klik pertama sudah meninggalkan halaman dan
 * trigger tidak mungkin terjadi.
 */
const TRIPLE_CLICK_WINDOW_MS = 450;

type TripleClickLinkProps = {
  href: string;
  className?: string;
  children: React.ReactNode;
};

/**
 * Tautan yang menuju `href` seperti biasa, tapi membuka halaman login admin
 * bila diklik tiga kali beruntun.
 *
 * Entry point admin sengaja disembunyikan supaya tidak bisa ditebak dari
 * markup publik. Ini adalah obfuscation, bukan security — payoff-nya ada di
 * password login `/adm-cms-hb/login`.
 */
export function TripleClickLink({ href, className, children }: TripleClickLinkProps) {
  const router = useRouter();
  const clicks = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    clicks.current = 0;
  }, []);

  // Jangan sampai timer yang sudah dijadwalkan menavigasi setelah unmount.
  useEffect(() => clear, [clear]);

  const onClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      // Navigasi selalu dilakukan manual supaya klik pertama tidak langsung
      // meninggalkan halaman.
      event.preventDefault();
      clicks.current += 1;

      if (clicks.current >= CLICKS_REQUIRED) {
        clear();
        router.push(ADMIN_ENTRY);
        return;
      }

      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        clear();
        router.push(href);
      }, TRIPLE_CLICK_WINDOW_MS);
    },
    [clear, href, router],
  );

  return (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  );
}
