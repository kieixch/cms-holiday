"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

/** Satu kategori yang bisa dipilih sebagai tempat paket baru. */
export type NewPackageCategory = {
  slug: string;
  label: string;
  /** `OPEN_TRIP` atau `PRIVATE`; hanya dipakai untuk keterangan di popup. */
  kind: string;
  packages: number;
};

type Props = {
  categories: NewPackageCategory[];
};

/**
 * Tombol "Paket Baru" beserta popup kategori tujuan.
 *
 * Kategori dipilih lebih dulu, baru halaman edit dibuka. Alasannya `kind` paket
 * tidak bisa ditebak dari form: `savePackageAction()` menyusunnya dari
 * kategori, dan nilai itu ikut menentukan apakah paket punya halaman detail
 * serta renderer mana yang dipakai (`.hb2d1n--opentrip` atau `--category`).
 * Kalau paket dibuat sebelum kategori dipilih, dua keputusan itu harus ditebak
 * ulang kemudian — dan menebaknya salah berarti paket diam-diam tidak tampil di
 * listing yang seharusnya.
 *
 * Daftarnya dikirim dari server, jadi isinya persis kategori yang benar-benar
 * ada. Tidak ada kategori karangan, dan kategori yang baru dihapus tidak mungkin
 * masih bisa dipilih.
 */
export function NewPackageButton({ categories }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => setOpen(false), []);

  // Fokuskan tombol tutup supaya Escape dan Tab langsung masuk ke dalam popup,
  // bukan ke baris kategori di halaman yang tertutupinya.
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close, open]);

  return (
    <>
      <button
        type="button"
        className="admin-btn admin-btn--primary"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        Paket Baru
      </button>

      {open ? (
        <div
          className="admin-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-package-title"
          onClick={(event) => {
            // Hanya klik pada lapisan gelap yang menutup. Klik di dalam panel
            // tidak ikut menutup, karena user masih saja sedang membaca
            // keterangan kategori.
            if (event.target === event.currentTarget) close();
          }}
        >
          <div className="admin-modal__panel">
            <header className="admin-modal__head">
              <h2 id="new-package-title">Paket baru masuk kategori mana?</h2>
              <button
                ref={closeRef}
                type="button"
                className="admin-btn admin-btn--small"
                onClick={close}
              >
                Tutup
              </button>
            </header>

            {categories.length === 0 ? (
              <p className="admin-empty admin-empty--tight">
                Belum ada kategori, jadi belum ada tempat untuk paket baru. Buat kategorinya dulu
                di <Link href="/adm-cms-hb/kategori/baru">Kategori baru</Link>.
              </p>
            ) : (
              <ul className="admin-modal__list">
                {categories.map((category) => (
                  <li key={category.slug}>
                    <button
                      type="button"
                      className="admin-modal__row"
                      onClick={() =>
                        router.push(
                          `/adm-cms-hb/paket/baru?kategori=${encodeURIComponent(category.slug)}`,
                        )
                      }
                    >
                      <span className="admin-modal__row-main">
                        <strong>{category.label}</strong>
                        <code>/{category.slug}</code>
                      </span>
                      <span className="admin-modal__row-meta">
                        {category.kind === "OPEN_TRIP" ? "Open Trip" : "Private"} ·{" "}
                        {category.packages} paket
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <footer className="admin-modal__foot">
              <p className="admin-hint">
                Kategori bisa diganti lagi setelah paket dibuat, di bagian “Identitas &amp;
                Status”.
              </p>
              <button type="button" className="admin-btn admin-btn--ghost" onClick={close}>
                Batal
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </>
  );
}