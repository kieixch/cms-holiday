import { ImageResponse } from "next/og";

/**
 * OG image bawaan (1200×630) untuk semua halaman yang tidak punya gambar
 * sendiri. Sengaja dibuat sebagai komponen route `opengraph-image.tsx` —
 * Next merender & meng-cache-nya otomatis, lalu menyuntikkan `og:image`
 * (dan `twitter:image`) ke setiap halaman yang mewarisi root layout.
 *
 * Brand: latar hijau tua `#163C32` + teks putih, konsisten dengan palet
 * situs. Tanpa gambar eksternal supaya tidak bergantung jaringan saat build.
 */
export const alt = "Holiday Banyuwangi — Paket tour & open trip di Banyuwangi";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(135deg, #163C32 0%, #245447 55%, #3F705D 100%)",
          color: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "#DDE8E1",
              color: "#163C32",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 36,
              fontWeight: 800,
            }}
          >
            HB
          </div>
          <div style={{ display: "flex", fontSize: 34, fontWeight: 700, letterSpacing: 1, color: "#DDE8E1" }}>
            HOLIDAY BANYUWANGI
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", fontSize: 76, fontWeight: 800, lineHeight: 1.05 }}>
            Jelajahi Keindahan Banyuwangi
          </div>
          <div style={{ display: "flex", fontSize: 36, color: "#DDE8E1", lineHeight: 1.3 }}>
            Open trip &amp; private trip ke Kawah Ijen, Pulau Merah, Baluran,
            <br />
            Djawatan, dan destinasi timur Banyuwangi lainnya.
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 30, color: "#DDE8E1", opacity: 0.9 }}>
          holidaybanyuwangi.vercel.app
        </div>
      </div>
    ),
    { ...size },
  );
}
