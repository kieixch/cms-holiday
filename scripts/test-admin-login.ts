/**
 * Buktikan login admin bekerja sungguhan, lewat protokol yang sama dengan yang
 * dipakai browser.
 *
 * `check-admin.ts` hanya membandingkan password dengan hash; itu belum
 * membuktikan form login-nya bisa dipakai. Script ini mengirim form seperti
 * progressive enhancement (tanpa JavaScript) lalu memeriksa:
 *
 *   1. password salah  -> ditolak, tidak ada cookie sesi
 *   2. email tak dikenal -> ditolak
 *   3. kredensial benar -> cookie `hb_admin_session` terbit + redirect /adm-cms-hb
 *   4. cookie itu       -> panel terbuka, anonim tetap ditolak
 *
 * Cara ini sengaja memakai POST form biasa, bukan header `Next-Action`.
 * `useActionState` mengirim state ter-encode sebagai argumen pertama, dan
 * merekonstruksi wire format itu dari luar browser rapuh: butuh
 * `bound`/`$ACTION_KEY` yang berubah tiap render. Form biasa stabil.
 *
 * Perlu: `pnpm dev` atau `pnpm start` jalan di `ADMIN_LOGIN_TEST_BASE`.
 */
import "dotenv/config";

const BASE = process.env.ADMIN_LOGIN_TEST_BASE ?? "http://localhost:3000";

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

/**
 * Body multipart sebagai string, dengan `Content-Type` multipart yang di-set
 * manual di pemanggil.
 *
 * String (bukan `Buffer`) supaya aman terhadap tipe `BodyInit` yang dipakai
 * lib DOM di proyek ini; `fetch` tetap menghitung `Content-Length` sendiri
 * untuk body string.
 */
function multipart(fields: Record<string, string>, boundary: string): string {
  let text = "";
  for (const [name, value] of Object.entries(fields)) {
    text += `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`;
  }
  text += `--${boundary}--\r\n`;
  return text;
}

type ActionRef = { id: string; key: string };

/** Ambil ID + key server action dari HTML halaman login. */
async function readActionRef(): Promise<ActionRef> {
  const html = await (await fetch(`${BASE}/adm-cms-hb/login`)).text();
  const id = html.match(/id&quot;:&quot;([a-f0-9]+)&quot;/)?.[1];
  const key = html.match(/name="\$ACTION_KEY" value="([^"]+)"/)?.[1];
  if (!id || !key) throw new Error("tidak menemukan ID/key server action di halaman login");
  return { id, key };
}

async function submitLogin(
  ref: ActionRef,
  email: string,
  password: string,
): Promise<Response> {
  const fields: Record<string, string> = {
    $ACTION_REF_1: "",
    "$ACTION_1:0": `{"id":"${ref.id}","bound":"$@1"}`,
    "$ACTION_1:1": "[{}]",
    $ACTION_KEY: ref.key,
    email,
    password,
  };

  const boundary = `----opencodeLogin${Date.now().toString(16)}`;
  const body = multipart(fields, boundary);

  return fetch(`${BASE}/adm-cms-hb/login`, {
    method: "POST",
    headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
    body,
    redirect: "manual",
  });
}

function sessionCookie(res: Response): string | null {
  for (const cookie of res.headers.getSetCookie()) {
    const match = cookie.match(/hb_admin_session=([^;]+)/);
    if (match?.[1]) return match[1];
  }
  return null;
}

async function main() {
  console.log(`Menguji login di ${BASE}\n`);

  const health = await fetch(`${BASE}/adm-cms-hb/login`, { redirect: "manual" });
  check("halaman login terjangkau", health.status === 200, `status ${health.status}`);
  if (health.status !== 200) {
    console.log("\nServer tidak jalan. Jalankan `pnpm dev` lebih dulu.");
    process.exit(1);
  }

  const ref = await readActionRef();
  const email = process.env.ADMIN_TEST_EMAIL ?? "admin@holidaybanyuwangi.com";
  const password = process.env.ADMIN_TEST_PASSWORD;
  if (!password) {
    console.log(
      "\nADMIN_TEST_PASSWORD belum diisi. Set di .env atau lingkungan, contoh:\n" +
        '  set "ADMIN_TEST_PASSWORD=..." && pnpm test:login\n' +
        "Password tidak disimpan di kode agar tidak bocor lewat repo.",
    );
    process.exit(1);
  }

  console.log("1. Password salah ditolak");
  {
    const res = await submitLogin(ref, email, "password-yang-salah");
    check("tidak ada cookie sesi", sessionCookie(res) === null);
    check("tidak dialihkan ke /adm-cms-hb", (res.headers.get("location") ?? "") !== "/adm-cms-hb");
  }

  console.log("\n2. Email tidak dikenal ditolak");
  {
    const res = await submitLogin(ref, "tidak@ada.com", password);
    check("tidak ada cookie sesi", sessionCookie(res) === null);
  }

  console.log("\n3. Kredensial benar membuat sesi");
  const token = await (async () => {
    const res = await submitLogin(ref, email, password);
    const cookie = sessionCookie(res);
    check("cookie sesi terbit", cookie !== null, cookie ? `${cookie.slice(0, 20)}…` : "tidak ada");
    check(
      "dialihkan ke /adm-cms-hb",
      res.headers.get("location") === "/adm-cms-hb",
      res.headers.get("location") ?? "(tanpa location)",
    );
    return cookie;
  })();

  if (!token) {
    console.log(`\n${pass} lulus, ${fail} gagal — login gagal.`);
    process.exit(1);
  }

  console.log("\n4. Sesi itu benar-benar membuka panel");
  {
    const auth = { cookie: `hb_admin_session=${token}` };

    for (const path of ["/adm-cms-hb", "/adm-cms-hb/kategori", "/adm-cms-hb/kategori/baru", "/adm-cms-hb/gallery"]) {
      const res = await fetch(`${BASE}${path}`, { headers: auth, redirect: "manual" });
      check(`${path} terbuka`, res.status === 200, `status ${res.status}`);
    }

    const anon = await fetch(`${BASE}/adm-cms-hb`, { redirect: "manual" });
    check(
      "tanpa sesi tetap dialihkan",
      anon.status === 307 || anon.status === 302,
      `status ${anon.status}`,
    );

    const publik = await fetch(`${BASE}/`, { redirect: "manual" });
    check("beranda publik tidak terganggu", publik.status === 200, `status ${publik.status}`);
  }

  console.log(`\n${pass} lulus, ${fail} gagal`);
  process.exit(fail ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
