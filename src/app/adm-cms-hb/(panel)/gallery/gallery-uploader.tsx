"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Uploaded = { id: string; url: string; filename: string };
type Failure = { name: string; error: string };
type Note = { kind: "ok" | "error"; text: string };

/** Hasil satu request upload (satu file). */
type FileOutcome =
  | { ok: true; saved: Uploaded[] }
  | { ok: false; error: string; fatal: boolean };

/** Satu file yang dipilih, dengan object URL untuk pratinjau lokal. */
type Picked = { file: File; preview: string; width: number | null; height: number | null };

/**
 * Form upload galeri.
 *
 * Pakai XHR, bukan `fetch`, karena `fetch` tidak punya event progress upload —
 * tanpa ini user tidak melihat apa-apa selama foto 8 MB naik di koneksi seluler
 * dan cenderung menekan tombol dua kali.
 */
export function GalleryUploader({ folders }: { folders: string[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [folder, setFolder] = useState("");
  const [alt, setAlt] = useState("");
  const [busy, setBusy] = useState(false);
  const [percent, setPercent] = useState<number | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  const [message, setMessage] = useState<Note | null>(null);
  const [picked, setPicked] = useState<Picked[]>([]);

  // Object URL dipakai untuk pratinjau sebelum file diunggah. Kalau tidak
  // dicabut, setiap pemilihan gambar menahan salinan file penuh di memori
  // sampai tab ditutup.
  //
  // Pencabutan dilakukan eksplisit di setiap tempat item dibuang (lihat
  // `clearPicked` dan tombol "Buang"). Efek di sini hanya membersihkan sisa
  // saat komponen dilepas. Kalau cleanup bergantung pada `picked`, satu
  // pencabutan akan ikut mengenai item yang masih tampil karena closure
  // effect lama masih memegang array sebelumnya.
  const pickedRef = useRef<Picked[]>([]);

  useEffect(() => {
    // Disinkronkan di dalam efek, bukan saat render: React membolehkan menulis
    // ref di efek, dan cleanup unmount jadi selalu melihat daftar terbaru.
    pickedRef.current = picked;
  }, [picked]);

  useEffect(() => {
    return () => {
      for (const item of pickedRef.current) URL.revokeObjectURL(item.preview);
    };
  }, []);

  // `reset` sengaja TIDAK menyentuh `message`. Kedua pemanggilnya (jalur
  // error di `load` dan `onerror`) memanggil `setMessage` sesaat sebelum
  // `reset` — kalau `reset` ikut `setMessage(null)`, React batching
  // menjadikan null sebagai state akhir dan notifikasi error tidak pernah
  // tampil. Itu bug nyata: upload yang gagal selalu diam tanpa pesan apa
  // pun. Pembersihan pesan saat submit dilakukan eksplisit di `onSubmit`.
  function reset() {
    setBusy(false);
    setPercent(null);
    setStage(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function clearPicked() {
    for (const item of picked) URL.revokeObjectURL(item.preview);
    setPicked([]);
    if (inputRef.current) inputRef.current.value = "";
  }

  /** Baca dimensi lewat `Image` supaya admin tahu resolusi sebelum mengunggah. */
  function readDimensions(file: File): Promise<{ width: number; height: number } | null> {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new window.Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  }

  async function onPickFiles() {
    const files = Array.from(inputRef.current?.files ?? []);
    if (files.length === 0) {
      setPicked([]);
      return;
    }

    for (const item of picked) URL.revokeObjectURL(item.preview);

    const next: Picked[] = await Promise.all(
      files.map(async (file) => {
        const size = await readDimensions(file);
        return {
          file,
          preview: URL.createObjectURL(file),
          width: size?.width ?? null,
          height: size?.height ?? null,
        };
      }),
    );
    setPicked(next);
  }

  /**
   * Kirim satu file ke server dan tunggu hasilnya.
   *
   * `onProgress` melapor byte yang sudah terkirim pada request ini, supaya
   * progress bar bisa dihitung terhadap total seluruh file.
   */
  function uploadFile(
    file: File,
    altText: string,
    onProgress: (loaded: number) => void,
  ): Promise<FileOutcome> {
    return new Promise((resolve) => {
      const body = new FormData();
      body.append("file", file);
      if (folder) body.append("folder", folder);
      if (altText) body.append("alt", altText);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/admin/gallery");

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) onProgress(e.loaded);
      });

      xhr.addEventListener("load", () => {
        let payload: { saved?: Uploaded[]; failures?: Failure[]; error?: string } = {};
        try {
          payload = JSON.parse(xhr.responseText);
        } catch {
          // Body bukan JSON: biasanya halaman error dari proxy di depan Next.
          payload = {};
        }

        if (xhr.status >= 200 && xhr.status < 300 && payload.saved?.length) {
          resolve({ ok: true, saved: payload.saved });
          return;
        }

        resolve({
          ok: false,
          error: describeFailure(xhr.status, payload),
          fatal: isFatalStatus(xhr.status),
        });
      });

      xhr.addEventListener("error", () => {
        resolve({ ok: false, error: "Koneksi terputus saat upload.", fatal: true });
      });

      xhr.addEventListener("abort", () => {
        resolve({ ok: false, error: "Upload dibatalkan.", fatal: true });
      });

      xhr.send(body);
    });
  }

  /**
   * Unggah semua file yang dipilih, satu file per request.
   *
   * Dua fase:
   *   1. Perkecil & konversi ke WebP di browser. Vercel membatasi body request
   *      ke 4.5 MB dan batas itu TIDAK bisa dinaikkan lewat config, jadi foto
   *      kamera (3-25 MB) harus dikecilkan sebelum dikirim.
   *   2. Kirim satu file per request, supaya request tetap kecil dan status
   *      413 (kalau ada proxy lain di depan) menunjuk ke file yang salah.
   */
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (picked.length === 0) {
      setMessage({ kind: "error", text: "Pilih minimal satu foto dulu." });
      return;
    }

    setBusy(true);
    setMessage(null);
    setPercent(0);

    const items = picked;
    const prepared: { file: File; original: string }[] = [];
    for (let i = 0; i < items.length; i++) {
      setStage(`Menyiapkan foto ${i + 1} dari ${items.length}…`);
      const file = await compressForUpload(items[i].file);
      prepared.push({ file, original: items[i].file.name });
    }
    setStage(null);

    const totalBytes = prepared.reduce((sum, p) => sum + p.file.size, 0) || 1;
    let doneBytes = 0;
    let aborted = false;
    const saved: Uploaded[] = [];
    const failures: Failure[] = [];

    for (const { file, original } of prepared) {
      const outcome = await uploadFile(file, alt.trim(), (loaded) => {
        setPercent(Math.round(((doneBytes + loaded) / totalBytes) * 100));
      });
      doneBytes += file.size;

      if (outcome.ok) {
        saved.push(...outcome.saved);
      } else {
        failures.push({ name: original, error: outcome.error });
        // Sesi habis atau server error: sisa file tidak akan berhasil juga,
        // jadi berhenti daripada menumpuk request yang pasti gagal.
        if (outcome.fatal) {
          aborted = true;
          break;
        }
      }
      setPercent(Math.round((doneBytes / totalBytes) * 100));
    }

    reset();

    if (saved.length === 0) {
      setMessage({
        kind: "error",
        text: failures[0]?.error ?? "Tidak ada file yang berhasil diunggah.",
      });
      return;
    }

    const parts = [`${saved.length} foto diunggah`];
    if (failures.length) {
      const detail = failures
        .slice(0, 3)
        .map((f) => `${f.name} (${f.error})`)
        .join("; ");
      parts.push(`${failures.length} gagal: ${detail}`);
    }
    if (aborted) parts.push("upload dihentikan");

    setMessage({
      kind: failures.length ? "error" : "ok",
      text: `${parts.join(". ")}.`,
    });
    setAlt("");
    clearPicked();
    router.refresh();
  }

  const totalBytes = picked.reduce((sum, item) => sum + item.file.size, 0);

  return (
    <form className="admin-card admin-media-upload" onSubmit={onSubmit}>
      <div className="admin-media-upload__row">
        <label className="admin-field">
          <span className="admin-field__label">Foto (boleh pilih banyak)</span>
          <input
            ref={inputRef}
            className="admin-input"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
            multiple
            required
            disabled={busy}
            onChange={onPickFiles}
          />
        </label>

        <label className="admin-field">
          <span className="admin-field__label">Folder</span>
          <input
            className="admin-input"
            list="gallery-folders"
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            placeholder="e.g. paket-3d2n"
            disabled={busy}
          />
          <datalist id="gallery-folders">
            {folders.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </label>

        <label className="admin-field">
          <span className="admin-field__label">Teks alternatif</span>
          <input
            className="admin-input"
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            placeholder="Deskripsi singkat untuk semua foto ini"
            disabled={busy}
          />
        </label>
      </div>

      {picked.length > 0 ? (
        <div className="admin-picked">
          <p className="admin-picked__head">
            {picked.length} foto dipilih · {kb(totalBytes)}
            <button type="button" className="admin-btn admin-btn--small admin-btn--ghost" onClick={clearPicked} disabled={busy}>
              Batalkan pilihan
            </button>
          </p>
          <ul className="admin-picked__grid">
            {picked.map((item, index) => (
              <li key={item.preview} className="admin-picked__item">
                {/* Blob lokal, bukan next/image: URL-nya dibuat runtime dan
                    tidak akan lolos optimizer Next. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.preview}
                  alt={`Pratinjau ${item.file.name}`}
                  className="admin-picked__img"
                />
                <p className="admin-picked__name" title={item.file.name}>
                  {item.file.name}
                </p>
                <p className="admin-picked__meta">
                  {item.width && item.height ? `${item.width}×${item.height}` : "—"} ·{" "}
                  {kb(item.file.size)}
                </p>
                <button
                  type="button"
                  className="admin-btn admin-btn--small admin-btn--danger"
                  disabled={busy}
                  onClick={() => {
                    URL.revokeObjectURL(item.preview);
                    const files = picked.filter((_, i) => i !== index);
                    setPicked(files);
                    if (inputRef.current) {
                      const transfer = new DataTransfer();
                      for (const f of files) transfer.items.add(f.file);
                      inputRef.current.files = transfer.files;
                    }
                  }}
                >
                  Buang
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Progress upload */}
      {percent !== null && (
        <div
          className="admin-progress"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="admin-progress__bar" style={{ width: `${percent}%` }} />
          <span className="admin-progress__label">{percent}%</span>
        </div>
      )}

      {stage && <p className="admin-hint">{stage}</p>}

      <div className="admin-media-upload__actions">
        <button type="submit" className="admin-btn" disabled={busy || picked.length === 0}>
          {busy ? "Mengunggah…" : `Unggah ${picked.length > 0 ? `${picked.length} foto` : ""}`}
        </button>
        <p className="admin-hint">
          Foto diperkecil & dikonversi ke WebP di browser sebelum dikirim (maks 2400px), lalu
          divalidasi ulang di server. SVG ditolak karena bisa jadi celah XSS.
        </p>
      </div>

      {message && (
        <p className={message.kind === "ok" ? "admin-alert admin-alert--ok" : "admin-alert admin-alert--error"}>
          {message.text}
        </p>
      )}
    </form>
  );
}

function kb(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Batas dimensi & kualitas, sama dengan default server (`MEDIA_MAX_EDGE`, `MEDIA_WEBP_QUALITY`). */
const COMPRESS_MAX_EDGE = 2400;
const COMPRESS_QUALITY = 0.82;

/** Format yang bisa dikecilkan di browser. SVG sengaja tidak termasuk. */
const COMPRESSIBLE = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"]);

type Drawable = ImageBitmap | HTMLImageElement;

async function loadDrawable(file: File): Promise<Drawable | null> {
  if (typeof createImageBitmap === "function") {
    try {
      // `from-image` menghormati orientasi EXIF, sama seperti `rotate()` di sharp.
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      /* jatuh ke <img> di bawah */
    }
  }

  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement | null>((resolve) => {
      const img = new window.Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Perkecil + konversi ke WebP di browser sebelum diunggah.
 *
 * Vercel menolak body request di atas 4.5 MB dan angka itu tidak bisa
 * dinaikkan, jadi foto kamera harus dikecilkan dulu di klien. Server tetap
 * memvalidasi dan meng-encode ulang dengan sharp — ini hanya supaya request
 * muat, bukan pengganti validasi server.
 *
 * Kalau hasil kompresi tidak lebih kecil (gambar sudah kecil), file asli
 * dikembalikan; kalau proses gagal, file asli juga dikembalikan dan server
 * yang memutuskan.
 */
async function compressForUpload(file: File): Promise<File> {
  if (!COMPRESSIBLE.has(file.type.toLowerCase())) return file;

  let drawable: Drawable | null = null;
  try {
    drawable = await loadDrawable(file);
    if (!drawable) return file;

    const scale = Math.min(
      1,
      COMPRESS_MAX_EDGE / Math.max(drawable.width, drawable.height),
    );
    const width = Math.max(1, Math.round(drawable.width * scale));
    const height = Math.max(1, Math.round(drawable.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(drawable, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", COMPRESS_QUALITY),
    );
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name, { type: blob.type || "image/webp" });
  } catch {
    return file;
  } finally {
    if (drawable && typeof ImageBitmap !== "undefined" && drawable instanceof ImageBitmap) {
      drawable.close();
    }
  }
}

/**
 * Pesan error untuk satu request upload yang gagal.
 *
 * 413 perlu dibedakan: dari kode kita sendiri respons 413 selalu JSON
 * (limit total di route), sedangkan 413 tanpa body JSON datang dari proxy
 * di depan Next (nginx di VPS) yang menolak body terlalu besar.
 */
function describeFailure(
  status: number,
  payload: { error?: string; failures?: Failure[] },
): string {
  if (payload.error) return payload.error;
  if (payload.failures?.length) return payload.failures[0].error;
  if (status === 413) {
    return "File ditolak: ukuran file melebihi batas body di proxy/server (HTTP 413). Naikkan client_max_body_size di nginx atau pakai file yang lebih kecil.";
  }
  if (status === 401) return "Sesi sudah habis. Muat ulang halaman lalu login lagi.";
  if (status === 403) return "Akses ditolak.";
  if (status === 0) return "Server tidak merespons.";
  return `Upload gagal (HTTP ${status}).`;
}

/**
 * Status yang membuat sisa file tidak berguna: sesi habis, akses
 * ditolak, atau server error. 413 TIDAK termasuk — itu hanya soal ukuran
 * file itu sendiri, file lain masih mungkin muat.
 */
function isFatalStatus(status: number): boolean {
  return status === 0 || status === 401 || status === 403 || status >= 500;
}