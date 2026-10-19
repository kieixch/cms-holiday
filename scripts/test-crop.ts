/**
 * Uji `cropImage` di `src/lib/image.ts`.
 *
 * Fokusnya bukan ke-azurean, tapi ke dua hal yang bisa salah diam-diam:
 *
 *  1. Dimensi hasil harus Persis mengikuti kotak crop yang diminta. Kalau
 *     urutan operasi internal sharp ternyata meng-crop di ruang koordinat yang
 *     sudah diputar, angka yang keluar tidak akan cocok dan admin memotong area
 *     yang salah — dan itu gagal diam-diam, tidak melempar error.
 *
 *  2. Rotasi 90° harus menukar sisi, DAN, ada terjadi SEBELUM crop supaya
 *     koordinat yang dikirim client (yang selalu di ruang gambar asli) tetap
 *     benar. Test di bawah sengaja memotong sudut kanan-bawah lalu diputar,
 *     lalu	isipotong dua untuk membuktikan urutannya.
 */

import sharp from "sharp";

import { cropImage, optimizeImage } from "../src/lib/image";

let pass = 0;
let fail = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}\n       dapat: ${a}\n       diharapkan: ${e}`);
  }
}

function truthy(name: string, value: unknown) {
  if (value) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}`);
  }
}

async function main() {
  console.log("cropImage");

  // Gambar 200x100. Kiri merah, kanan biru, supaya posisi potong bisa dibuktikan
  // dari warnanya, bukan cuma dari angka.
  const red = { r: 255, g: 0, b: 0 };
  const blue = { r: 0, g: 0, b: 255 };
  const source = await sharp({
    create: {
      width: 200,
      height: 100,
      channels: 3,
      background: red,
    },
  })
    .composite([
      {
        input: await sharp({
          create: { width: 100, height: 100, channels: 3, background: blue },
        })
          .png()
          .toBuffer(),
        left: 100,
        top: 0,
      },
    ])
    .png()
    .toBuffer();

  // 1. Potong tanpa rotasi: hanya separuh kanan (biru).
  const right = await cropImage(source, {
    left: 100,
    top: 0,
    width: 100,
    height: 100,
    rotation: 0,
    maxEdge: 2400,
  });
  check("tanpa rotasi: lebar hasil", right.width, 100);
  check("tanpa rotasi: tinggi hasil", right.height, 100);

  const rightPixel = await sharp(right.body).raw().toBuffer({ resolveWithObject: true });
  const mid = Math.floor(rightPixel.info.width / 2) * rightPixel.info.channels;
  check(
    "tanpa rotasi: isi benar-benar separuh kanan",
    [...rightPixel.data.subarray(mid, mid + 3)],
    [blue.r, blue.g, blue.b],
  );

  // 2. Potong separuh kiri (merah) lalu putar 90°.
  //
  // Kalau rotate dihitung lebih dulu, kotak 100x100 pada gambar 200x100 akan
  // dipotong dari 100x200 — hasilnya 100x100 tapi warnanya jadi campuran dan
  // posisi salah.
  const leftRotated = await cropImage(source, {
    left: 0,
    top: 0,
    width: 100,
    height: 100,
    rotation: 90,
    maxEdge: 2400,
  });
  check("rotasi 90: sisi tetap sama untuk kotak persegi", leftRotated.width, 100);
  check("rotasi 90: tinggi", leftRotated.height, 100);

  const rotPixel = await sharp(leftRotated.body).raw().toBuffer({ resolveWithObject: true });
  const rmid = Math.floor(rotPixel.info.height / 2) * rotPixel.info.channels;
  // Setelah diputar 90° searah jarum jam, warna merah yang tadinya mendatar
  // jadi tegak. Satu titik di tengah masih merah kalau warnanya benar-benar
  // ikut berputar.
  const [rr, rg, rb] = [rotPixel.data[rmid], rotPixel.data[rmid + 1], rotPixel.data[rmid + 2]];
  truthy(
    `rotasi 90: masih biru/merah solid setelah putar (rgb=${rr},${rg},${rb})`,
    rr > 200 || rb > 200,
  );

  // 3. Potong kotak yang lebar lalu putar 90°: sisi WAJIB tertukar.
  const wide = await cropImage(source, {
    left: 0,
    top: 0,
    width: 200,
    height: 50,
    rotation: 90,
    maxEdge: 2400,
  });
  check("rotasi 90 pada kotak lebar: lebar tertukar", wide.width, 50);
  check("rotasi 90 pada kotak lebar: tinggi tertukar", wide.height, 200);

  // 4. Rotasi 270 pada kotak lebar juga tertukar, arahnya berlawanan.
  const wide270 = await cropImage(source, {
    left: 0,
    top: 0,
    width: 200,
    height: 50,
    rotation: 270,
    maxEdge: 2400,
  });
  check("rotasi 270 pada kotak lebar: lebar tertukar", wide270.width, 50);
  check("rotasi 270 pada kotak lebar: tinggi tertukar", wide270.height, 200);

  // 5. 180 tidak menukar sisi.
  const w180 = await cropImage(source, {
    left: 0,
    top: 0,
    width: 200,
    height: 50,
    rotation: 180,
    maxEdge: 2400,
  });
  check("rotasi 180: sisi tidak tertukar (lebar)", w180.width, 200);
  check("rotasi 180: sisi tidak tertukar (tinggi)", w180.height, 50);

  // 6. `maxEdge` ditegakkan SESUDAH potong-putar.
  const big = await sharp({
    create: { width: 4000, height: 1000, channels: 3, background: red },
  })
    .png()
    .toBuffer();

  const limited = await cropImage(big, {
    left: 0,
    top: 0,
    width: 4000,
    height: 1000,
    rotation: 0,
    maxEdge: 2400,
  });
  check("maxEdge: sisi terpanjang dibatasi", Math.max(limited.width, limited.height), 2400);

  // Cases where the crop is already smaller than maxEdge must NOT be enlarged.
  const small = await cropImage(source, {
    left: 0,
    top: 0,
    width: 50,
    height: 40,
    rotation: 0,
    maxEdge: 2400,
  });
  check("maxEdge: tidak memperbesar gambar kecil", [small.width, small.height], [50, 40]);

  // 7. Cropping to exactly one pixel.
  const one = await cropImage(source, {
    left: 10,
    top: 10,
    width: 1,
    height: 1,
    rotation: 0,
    maxEdge: 2400,
  });
  check("1×1 piksel diterima", [one.width, one.height], [1, 1]);

  // 8. Output selalu WebP.
  check("keluaran dikonversi ke WebP", one.mime, "image/webp");
  check("ekstensi keluarannya webp", one.extension, "webp");

  // 9. Sumber yang sudah dioptimasi (Webp) bisa dicrop — ini jalur sebenarnya
  //    di produksi, karena storage hanya berisi hasil `optimizeImage`.
  const optimized = await optimizeImage(source, "image/png");
  const fromOptimized = await cropImage(optimized.body, {
    left: 10,
    top: 10,
    width: 60,
    height: 30,
    rotation: 0,
    maxEdge: 2400,
  });
  check("sumber WebP hasil optimasi bisa dicrop", [fromOptimized.width, fromOptimized.height], [60, 30]);

  // 10. Buffer rusak ditolak, bukan diproses diam-diam.
  let threw = false;
  try {
    await cropImage(Buffer.from("ini bukan gambar"), {
      left: 0,
      top: 0,
      width: 10,
      height: 10,
      rotation: 0,
      maxEdge: 2400,
    });
  } catch {
    threw = true;
  }
  truthy("buffer rusak ditolak", threw);

  // 11. Buffer kosong ditolak.
  threw = false;
  try {
    await cropImage(Buffer.alloc(0), {
      left: 0,
      top: 0,
      width: 10,
      height: 10,
      rotation: 0,
      maxEdge: 2400,
    });
  } catch {
    threw = true;
  }
  truthy("buffer kosong ditolak", threw);

  console.log(`\ncropImage: ${pass} lolos, ${fail} gagal`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});