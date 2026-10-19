import { parseFields, type Field } from "../src/lib/admin/fields";
import { buildValidator, collectErrors } from "../src/lib/admin/validate";

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    pass++;
    console.log(`  ok   ${name}${detail ? ` - ${detail}` : ""}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}${detail ? ` - ${detail}` : ""}`);
  }
}

function eq(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  check(name, a === b, a === b ? "" : `dapat ${a}, harap ${b}`);
}

const spec: Field[] = [
  { kind: "text", name: "name", label: "Nama", required: true },
  { kind: "text", name: "note", label: "Catatan", empty: "null" },
  { kind: "text", name: "plain", label: "Biasa" },
  { kind: "textarea", name: "description", label: "Deskripsi" },
  { kind: "number", name: "order", label: "Urutan", min: 0, max: 100 },
  { kind: "number", name: "gridColumns", label: "Kolom", required: true, min: 1, max: 4 },
  { kind: "number", name: "optionalNum", label: "Angka opsional", empty: "null" },
  { kind: "boolean", name: "isPublished", label: "Terbit" },
  { kind: "boolean", name: "showInNav", label: "Di nav" },
  { kind: "select", name: "kind", label: "Jenis", options: [{ value: "OPEN_TRIP", label: "Open" }] },
  { kind: "strings", name: "heroBadges", label: "Badge" },
  {
    kind: "repeater",
    name: "benefits",
    label: "Keunggulan",
    children: [
      { kind: "text", name: "title", label: "Judul", required: true },
      { kind: "text", name: "description", label: "Deskripsi" },
      { kind: "number", name: "order", label: "Urutan" },
    ],
  },
  {
    kind: "repeater",
    name: "facilities",
    label: "Fasilitas",
    children: [
      { kind: "text", name: "title", label: "Judul", required: true },
      {
        kind: "repeater",
        name: "items",
        label: "Butir",
        children: [{ kind: "text", name: "text", label: "Teks", required: true }],
      },
    ],
  },
];

function form(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

function run() {
  console.log("\n1. Semua terisi");
  {
    const out = parseFields(
      form({
        name: "Paket 3D2N",
        note: "catatan",
        plain: "biasa",
        description: "deskripsi panjang",
        order: "5",
        gridColumns: "3",
        optionalNum: "12",
        isPublished: "on",
        showInNav: "on",
        kind: "OPEN_TRIP",
        heroBadges: "Ramah Keluarga\nCekatan Alam\n\n  Hemat  ",
        "benefits.__count": "2",
        "benefits.0.title": "Wifi",
        "benefits.0.description": "Gratis",
        "benefits.0.order": "1",
        "benefits.1.title": "Makan",
        "benefits.1.description": "4x",
        "benefits.1.order": "2",
      }),
      spec,
    );

    eq("nama terambil", out.name, "Paket 3D2N");
    eq("angka jadi number", out.order, 5);
    eq("checkbox true", out.isPublished, true);
    eq("array trim + buang kosong", out.heroBadges, ["Ramah Keluarga", "Cekatan Alam", "Hemat"]);
    eq("repeater 2 item", (out.benefits as unknown[]).length, 2);
    eq("repeater item pertama", (out.benefits as Record<string, unknown>[])[0], {
      title: "Wifi",
      description: "Gratis",
      order: 1,
    });
  }

  console.log("\n2. Form kosong / tidak tercentang");
  {
    const out = parseFields(form({}), spec);
    eq("required kosong jadi '' (untuk validator)", out.name, "");
    eq("nullable kosong jadi null", out.note, null);
    eq("non-nullable kosong jadi ''", out.plain, "");
    eq("checkbox tidak terkirim = false", out.isPublished, false);
    eq("number opsional kosong jadi null", out.optionalNum, null);
    eq("number opsional (order) kosong jadi null", out.order, null);
    eq("number wajib kosong jadi NaN", Number.isNaN(out.gridColumns as number), true);
    eq("array kosong = []", out.heroBadges, []);
    eq("repeater kosong = []", out.benefits, []);
  }

  console.log("\n3. Repeater: item kosong dibuang");
  {
    const out = parseFields(
      form({
        name: "X",
        "benefits.__count": "3",
        "benefits.0.title": "Ada",
        "benefits.0.description": "",
        "benefits.0.order": "",
        // item 1 sengaja kosong semua
        "benefits.1.title": "",
        "benefits.1.description": "",
        "benefits.1.order": "",
        "benefits.2.title": "Juga ada",
        "benefits.2.description": "d",
        "benefits.2.order": "3",
      }),
      spec,
    );
    const items = out.benefits as Record<string, unknown>[];
    eq("3 slot -> 2 item tersimpan", items.length, 2);
    eq("urutan tetap terjaga", items.map((i) => i.title), ["Ada", "Juga ada"]);
  }

  console.log("\n4. Repeater bersarang");
  {
    const out = parseFields(
      form({
        name: "X",
        "facilities.__count": "1",
        "facilities.0.title": "Termasuk",
        "facilities.0.items.__count": "3",
        "facilities.0.items.0.text": "Hotel",
        "facilities.0.items.1.text": "Makan",
        // items.2 kosong -> dibuang
        "facilities.0.items.2.text": "",
      }),
      spec,
    );
    const groups = out.facilities as { title: string; items: { text: string }[] }[];
    eq("1 grup", groups.length, 1);
    eq("2 butir (slot kosong dibuang)", groups[0].items.length, 2);
    eq("isi butir", groups[0].items.map((i) => i.text), ["Hotel", "Makan"]);
  }

  console.log("\n5. Jumlah repeater dibatasi");
  {
    const f = form({ name: "X", "benefits.__count": "9999" });
    const out = parseFields(f, spec);
    check("count dibatasi 200", (out.benefits as unknown[]).length <= 200, `${(out.benefits as unknown[]).length}`);
  }

  console.log("\n6. Validator: wajib diisi");
  {
    const schema = buildValidator(spec);
    const parsed = parseFields(form({ name: "  " }), spec);
    const result = schema.safeParse(parsed);
    check("nama kosong ditolak", !result.success);
    const { errors, first } = collectErrors(result.error!);
    eq("path error", errors[0].path, "name");
    check("pesan menyebut label", /Nama wajib diisi/.test(first ?? ""), first ?? "");
  }

  console.log("\n7. Validator: rentang angka");
  {
    const schema = buildValidator(spec);
    for (const [value, shouldPass] of [["0", true], ["100", true], ["101", false], ["-1", false], ["abc", false]] as const) {
      const parsed = parseFields(form({ name: "X", order: value, gridColumns: "2" }), spec);
      const result = schema.safeParse(parsed);
      eq(`order=${value}`, result.success, shouldPass);
    }
  }

  console.log("\n8. Validator: baris repeater terisi sebagian ditolak");
  {
    const schema = buildValidator(spec);
    // Baris yang seluruhnya kosong DIBUANG (memang perilaku yang diinginkan),
    // jadi yang harus diuji adalah baris yang terisi sebagian: deskripsi ada
    // tapi judulnya kosong. Baris seperti ini wajib ditolak.
    const parsed = parseFields(
      form({
        name: "X",
        gridColumns: "2",
        "benefits.__count": "2",
        "benefits.0.title": "Oke",
        "benefits.1.title": "",
        "benefits.1.description": "Isi tapi judulnya kosong",
      }),
      spec,
    );
    const items = parsed.benefits as Record<string, unknown>[];
    eq("baris kosong total dibuang, baris sebagian kept", items.length, 2);

    const result = schema.safeParse(parsed);
    check("baris sebagian ditolak", !result.success);
    const { errors } = collectErrors(result.error!);
    eq("path menyertakan indeks", errors[0].path, "benefits.1.title");
    check("pesan menyebut baris", /Baris 2/.test(errors[0].message), errors[0].message);
  }

  console.log("\n8b. Baris repeater kosong total tidak menggagalkan validasi");
  {
    const schema = buildValidator(spec);
    const parsed = parseFields(
      form({
        name: "X",
        gridColumns: "2",
        "benefits.__count": "3",
        "benefits.0.title": "Oke",
        "benefits.1.title": "",
        "benefits.2.title": "",
      }),
      spec,
    );
    eq("hanya 1 baris tersisa", (parsed.benefits as unknown[]).length, 1);
    check("lolos validasi", schema.safeParse(parsed).success);
  }

  console.log("\n9. Validator: number wajib kosong");
  {
    const schema = buildValidator(spec);
    const parsed = parseFields(form({ name: "Paket", gridColumns: "" }), spec);
    const result = schema.safeParse(parsed);
    check("ditolak", !result.success);
    const { errors } = collectErrors(result.error!);
    eq("path", errors[0].path, "gridColumns");
  }

  console.log("\n10. Validator: form valid");
  {
    const schema = buildValidator(spec);
    const parsed = parseFields(form({ name: "Paket", order: "3", gridColumns: "2" }), spec);
    check("lolos", schema.safeParse(parsed).success);
  }

  console.log("\n11. Field gambar");
  {
    const imageSpec: Field[] = [
      { kind: "image", name: "cardImage", label: "Gambar kartu", empty: "null" },
      { kind: "image", name: "heroImage", label: "Gambar utama", required: true },
      { kind: "image", name: "images", label: "Galeri", multiple: true },
    ];

    // Parsing: satu URL per baris untuk field banyak, string untuk tunggal.
    {
      const f = new FormData();
      f.set("cardImage", "/uploads/2026/10/a.webp");
      f.set("heroImage", "https://img.example/b.webp");
      f.set("images", "/uploads/a.webp\n\n/uploads/b.webp\n/uploads/c.webp");
      const parsed = parseFields(f, imageSpec);
      eq("gambar tunggal jadi string", parsed.cardImage, "/uploads/2026/10/a.webp");
      eq("gambar banyak jadi array", parsed.images, [
        "/uploads/a.webp",
        "/uploads/b.webp",
        "/uploads/c.webp",
      ]);
      // Baris kosong di tengah dibuang, sama seperti `kind: "strings"`.
      check("baris kosong dibuang", (parsed.images as string[]).length === 3, "");
    }

    // Field kosong.
    {
      const f = new FormData();
      f.set("heroImage", "/uploads/a.webp");
      const parsed = parseFields(f, imageSpec);
      eq("gambar tunggal kosong -> null", parsed.cardImage, null);
      eq("gambar banyak kosong -> array kosong", parsed.images, []);
    }

    const schema = buildValidator(imageSpec);

    check(
      "URL sah lolos",
      schema.safeParse({
        cardImage: "/uploads/a.webp",
        heroImage: "https://cdn.example/b.webp",
        images: ["/uploads/a.webp", "http://legacy.example/c.jpg"],
      }).success,
    );

    // Konten legacy: URL hasil impor lama bukan milik storage kita, tapi tetap
    // harus bisa dipakai.
    check(
      "URL WordPress lama tetap diterima",
      schema.safeParse({
        cardImage: "https://legacy.example/wp-content/uploads/x.jpg",
        heroImage: "/uploads/a.webp",
        images: [],
      }).success,
    );

    // Serangan: picker hanya menawarkan aset terunggah, tapi request bisa
    // dibuat langsung. Skema harus menolak apa pun yang bukan http(s) atau
    // /uploads/.
    for (const bad of [
      "javascript:alert(1)",
      "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
      "//evil.example/x.jpg",
      "/etc/passwd",
      "vbscript:msgbox(1)",
    ]) {
      const result = schema.safeParse({
        cardImage: bad,
        heroImage: "/uploads/a.webp",
        images: [],
      });
      check(`ditolak: ${bad.slice(0, 34)}`, !result.success);
    }

    {
      const result = schema.safeParse({
        cardImage: "/uploads/a.webp",
        heroImage: "/uploads/a.webp",
        images: ["/uploads/a.webp", "javascript:alert(1)"],
      });
      check("URL jahat di field banyak ikut ditolak", !result.success);
      if (!result.success) {
        const { errors } = collectErrors(result.error);
        eq("path field banyak", errors[0].path, "images.1");
      }
    }

    {
      const result = schema.safeParse({ cardImage: "/uploads/a.webp", heroImage: "", images: [] });
      check("gambar wajib kosong ditolak", !result.success);
      if (!result.success) {
        const { errors } = collectErrors(result.error);
        eq("path gambar wajib", errors[0].path, "heroImage");
      }
    }

    // Penting: kolom `String?` dengan `empty: "null"` harus menerima null.
    // Kalau tidak, kategori tanpa gambar tidak bisa disimpan sama sekali.
    check(
      "gambar opsional boleh null",
      schema.safeParse({ cardImage: null, heroImage: "/uploads/a.webp", images: [] }).success,
    );
  }

  console.log(`\n${pass} lulus, ${fail} gagal`);
  process.exit(fail ? 1 : 0);
}

run();
