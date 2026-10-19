"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

type Props = {
  /** Pesan yang ditanyakan sebelum form dikirim. */
  confirm: string;
  children: React.ReactNode;
  className?: string;
  title?: string;
  /** Teks tombol setuju. Default cocok untuk aksi hapus. */
  confirmLabel?: string;
  /** Teks tombol batal. */
  cancelLabel?: string;
};

/**
 * Tombol yang meminta konfirmasi lewat popup sendiri sebelum form dikirim.
 *
 * `window.confirm` tidak dipakai karena tidak bisa ditata dan tampil beda di
 * tiap peramban, jadi terasa lepas dari desain panel. Popup di sini memakai
 * gaya `.admin-modal` yang sama dengan pemilih kategori paket baru.
 *
 * Konfirmasi harus terjadi di client: server action tidak punya akses ke
 * `window`, jadi kalau penjagaannya ditaruh di server penghapusan akan terjadi
 * tanpa pernah ditanyakan.
 */
export function ConfirmSubmit({
  confirm,
  children,
  className,
  title,
  confirmLabel = "Ya, hapus",
  cancelLabel = "Batal",
}: Props) {
  const { pending } = useFormStatus();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const agree = useCallback(() => {
    setOpen(false);
    buttonRef.current?.form?.requestSubmit();
  }, []);

  return (
    <>
      <button
        ref={buttonRef}
        type="submit"
        className={className ?? "admin-btn admin-btn--danger"}
        title={title}
        disabled={pending}
        onClick={(event) => {
          event.preventDefault();
          setOpen(true);
        }}
      >
        {pending ? "Menghapus…" : children}
      </button>

      {open ? (
        <div
          className="admin-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="admin-modal__panel admin-modal__panel--confirm">
            <header className="admin-modal__head">
              <h2 id="confirm-title">Konfirmasi</h2>
            </header>

            <p className="admin-modal__text">{confirm}</p>

            <footer className="admin-modal__foot admin-modal__foot--end">
              <button
                type="button"
                className="admin-btn admin-btn--ghost"
                onClick={() => setOpen(false)}
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                className="admin-btn admin-btn--danger"
                onClick={agree}
                ref={confirmRef}
              >
                {confirmLabel}
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </>
  );
}