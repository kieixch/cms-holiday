import Image from "next/image";

import { waButtonHref } from "@/lib/wa";

/**
 * Menampilkan teks dengan penanda tebal `**teks**`.
 * Konvensi ini dipakai karena isi note-box disimpan sebagai teks biasa agar
 * tetap mudah disunting di panel admin, sementara markup legacy memakai
 * `<strong>` di tengah kalimat.
 */
export function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i}>{part.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

/** Kotak catatan kuning, muncul di listing Open Trip. */
export function NoteBox({ icon, text }: { icon: string | null; text: string | null }) {
  if (!text) return null;
  return (
    <div className="note-box">
      <span className="note-icon">{icon ?? "ℹ️"}</span>
      <span>
        <RichText text={text} />
      </span>
    </div>
  );
}

export type CtaBannerProps = {
  title: string;
  text: string;
  label: string;
  /**
   * Foto latar banner. Kosong (default) memakai gradasi hijau seperti semula.
   * Gambar dirender sebagai layer yang menutupi gradasi, plus overlay gelap
   * supaya judul dan tombol tetap terbaca di atas foto terang.
   */
  background?: string | null;
  waNumber: string;
  waMessage: string;
  /**
   * Link rotator untuk tombol. Bila terisi (mis. link Bitly), tombol menuju
   * link itu; kalau kosong tetap wa.me seperti biasa.
   */
  link?: string | null;
};

/**
 * Banner ajakan booking sebelum footer.
 * Jarak ke footer diatur lewat margin-bottom `.cta-banner` di green-palette.css
 * (bukan utility pb-*: padding bawah seksi ini ditimpa oleh
 * `.hb2d1n .container { padding: 0 20px }` karena spesifisitasnya lebih tinggi).
 *
 * Blok ini tampil begitu **salah satu** field-nya diisi — termasuk hanya latar
 * gambar — supaya pratinjau live editor langsung menunjukkan hasilnya, persis
 * seperti section Harga yang muncul segera setiap barisnya diisi. Kalau judul
 * dan teks masih kosong tapi latarnya sudah ada, yang tampil hanyalah fotonya;
 * tombol baru muncul setelah label tombol diisi.
 */
export function CtaBanner({
  title,
  text,
  label,
  background,
  waNumber,
  waMessage,
  link,
}: CtaBannerProps) {
  if (!title && !text && !label && !background) return null;
  return (
    <section className="container" data-reveal>
      <div className="cta-banner">
        {background ? (
          <div className="hbgl-cta-media" aria-hidden="true">
            <Image
              src={background}
              alt=""
              fill
              sizes="(max-width: 1100px) 100vw, 1100px"
              className="hbgl-cta-img"
            />
          </div>
        ) : null}
        {title ? <h2>{title}</h2> : null}
        {text ? <p>{text}</p> : null}
        {label ? (
          <a
            className="btn btn-primary"
            href={waButtonHref(link, waNumber, waMessage)}
            target="_blank"
            rel="noopener"
          >
            {label}
          </a>
        ) : null}
      </div>
    </section>
  );
}
