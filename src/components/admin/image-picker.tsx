"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

/** Satu aset yang sudah tersimpan, sesuai balasan `GET /api/admin/gallery`. */
export type PickerAsset = {
  id: string;
  url: string;
  filename: string;
  alt: string;
  width: number | null;
  height: number | null;
  folder: string;
  derivedFromId: string | null;
};

type Props = {
  /** Nama input, juga `path` untuk penandaan error. */
  name: string;
  label: string;
  help?: string;
  /** URL terpilih saat ini. Boleh string kosong/null. */
  value: string | null;
  /** Boleh memilih lebih dari satu (galeri paket). */
  multiple?: boolean;
  /** Penanda wajib. Field opsional tidak boleh menampilkan `*`. */
  required?: boolean;
  /** Daftar URL yang sudah terpilih. */
  values?: string[];
  error?: string;
  onChange: (value: string | string[] | null) => void;
};

/**
 * Kontrol pemilih gambar.
 *
 * Hanya menampilkan aset yang sudah ada di galeri — bukan tempat mengunggah.
 * Konsepnya: unggah sekali di `/admin/gallery`, lalu pakai di mana saja.
 *
 * Daftar tidak dikirim dari server lewat props. Kalau seluruh galeri ikut
 * seluruh galeri ikut di tiap form kategori/paket, admin dengan ribuan foto
 * akan membuat setiap halaman berat dan lambat. Daftar baru diambil saat
 * picker dibuka.
 */
export function ImagePicker({
  name,
  label,
  help,
  value,
  multiple = false,
  required = false,
  values = [],
  error,
  onChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [assets, setAssets] = useState<PickerAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const selected = multiple ? values : value ? [value] : [];

  /**
   * Ambil daftar saat dialog dibuka saja, dengan penundaan pencarian supaya
   * mengetik tidak memicu satu request per huruf.
   */
  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch(`/api/admin/gallery?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        if (res.status === 401) {
          setLoadError("Sesi habis. Muat ulang halaman.");
          return;
        }
        const payload = (await res.json()) as { assets?: PickerAsset[]; error?: string };
        if (payload.error) {
          setLoadError(payload.error);
          return;
        }
        setAssets(payload.assets ?? []);
      } catch (e) {
        // Request dibatalkan karena kata kunci berikutnya sudah masuk.
        if (e instanceof DOMException && e.name === "AbortError") return;
        setLoadError("Gagal memuat daftar gambar.");
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, term]);

  function choose(asset: PickerAsset) {
    if (!multiple) {
      onChange(asset.url);
      setOpen(false);
      return;
    }
    // Mode banyak: klik berarti tambah, dan URL yang sama tidak boleh masuk
    // dua kali.
    if (selected.includes(asset.url)) return;
    onChange([...selected, asset.url]);
  }

  function removeAt(index: number) {
    const next = selected.filter((_, i) => i !== index);
    onChange(multiple ? next : (next[0] ?? null));
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= selected.length) return;
    const next = [...selected];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved as string);
    onChange(multiple ? next : next[0]);
  }

  return (
    <div className="admin-field admin-span-full admin-picker">
      <span className="admin-field__label">
        {label}
        {required ? <span className="admin-req" aria-hidden="true"> *</span> : null}
      </span>

      {/*
        Input yang sebenarnya ikut terkirim ke server.

        Field banyak ditulis satu URL per baris, sama seperti `kind: "strings"`,
        jadi bentuknya konsisten dan `parseFields()` tidak perlu cabang baru.
        `readOnly` bukan `disabled` supaya nilainya tetap ikut submit.
      */}
      {multiple ? (
        <textarea name={name} readOnly hidden value={selected.join("\n")} />
      ) : (
        <input type="hidden" name={name} value={value ?? ""} />
      )}

      {selected.length === 0 ? (
        <p className="admin-picker__empty">
          Belum ada gambar dipilih.{" "}
          <button type="button" className="admin-linkbtn" onClick={() => setOpen(true)}>
            Pilih dari galeri
          </button>
        </p>
      ) : (
        <ul className="admin-picker__list">
          {selected.map((url, index) => (
            <li key={url} className="admin-picker__item">
              {/* URL bisa berasal dari impor lama di host luar, jadi `next/image`
                  tidak bisa dipakai: optimizer hanya boleh untuk origin sendiri. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="admin-picker__thumb" />
              <div className="admin-picker__meta">
                <code className="admin-picker__url" title={url}>
                  {url}
                </code>
                <span className="admin-picker__tools">
                  <button
                    type="button"
                    className="admin-btn admin-btn--small admin-btn--ghost"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label={`Naikkan gambar ${index + 1}`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn--small admin-btn--ghost"
                    onClick={() => move(index, 1)}
                    disabled={index === selected.length - 1}
                    aria-label={`Turunkan gambar ${index + 1}`}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn--small admin-btn--danger"
                    onClick={() => removeAt(index)}
                    aria-label={`Lepas gambar ${index + 1}`}
                  >
                    Lepas
                  </button>
                </span>
              </div>
            </li>
          ))}
          {multiple ? (
            <li className="admin-picker__add">
              <button
                type="button"
                className="admin-btn admin-btn--small"
                onClick={() => setOpen(true)}
              >
                + Tambah gambar
              </button>
            </li>
          ) : null}
        </ul>
      )}

      {help ? <small className="admin-field__help">{help}</small> : null}
      {error ? (
        <p className="admin-error" role="alert">
          {error}
        </p>
      ) : null}

      {open ? (
        <div className="admin-picker__modal" role="dialog" aria-modal="true" aria-label={label}>
          <div className="admin-picker__panel">
            <header className="admin-picker__head">
              <input
                autoFocus
                type="search"
                value={term}
                placeholder="Cari nama file, alt, atau folder"
                onChange={(e) => setTerm(e.target.value)}
              />
              <button
                type="button"
                className="admin-btn admin-btn--small"
                onClick={() => setOpen(false)}
              >
                Tutup
              </button>
            </header>

            {loading ? <p className="admin-empty admin-empty--tight">Memuat…</p> : null}
            {loadError ? <p className="admin-alert admin-alert--error">{loadError}</p> : null}

            {!loading && !loadError && assets.length === 0 ? (
              <p className="admin-empty admin-empty--tight">
                {term
                  ? `Tidak ada gambar yang cocok dengan "${term}".`
                  : "Galeri masih kosong. Unggah foto dulu di /admin/gallery."}
              </p>
            ) : null}

            <ul className="admin-picker__grid">
              {assets.map((asset) => {
                const chosen = selected.includes(asset.url);
                return (
                  <li key={asset.id}>
                    <button
                      type="button"
                      className={chosen ? "admin-picker__cell is-chosen" : "admin-picker__cell"}
                      onClick={() => choose(asset)}
                      aria-pressed={chosen}
                      title={`${asset.filename} — ${asset.width ?? "?"}x${asset.height ?? "?"}`}
                    >
                      <Image
                        src={asset.url}
                        alt={asset.alt || asset.filename}
                        width={asset.width ?? 200}
                        height={asset.height ?? 150}
                        sizes="160px"
                        style={{ objectFit: "cover" }}
                      />
                      <span className="admin-picker__cell-name">{asset.filename}</span>
                      {chosen ? <span className="admin-picker__badge">Dipakai</span> : null}
                    </button>
                  </li>
                );
              })}
            </ul>

            {multiple && selected.length > 0 ? (
              <footer className="admin-picker__foot">
                {selected.length} gambar dipilih
                <button
                  type="button"
                  className="admin-btn admin-btn--small"
                  onClick={() => setOpen(false)}
                >
                  Selesai
                </button>
              </footer>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}