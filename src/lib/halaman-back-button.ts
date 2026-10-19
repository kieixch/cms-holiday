/**
 * Tombol "kembali ke beranda" untuk dokumen `/halaman/<slug>`.
 *
 * Dokumen di route itu ditempel admin apa adanya dan sengaja tidak dibungkus
 * layout situs, jadi navigasi keluar tidak tersedia. Tombol ini disuntikkan
 * TEPAT SEBELUM `</body>` (atau `</html>`, atau di akhir kalau keduanya tidak
 * ada) supaya dokumen utuh maupun fragmen sama-sama mendapatkannya.
 *
 * Markup-nya sengaja memakai `<style>` inline dan tanpa JavaScript: CSP
 * `/halaman/*` mengizinkan `'unsafe-inline'`, dan tombol harus tetap jalan
 * walau dokumen admin mematikan JS. Label memuai saat hover/fokus — itulah
 * efek "popup"-nya — tapi tetap berupa tautan biasa.
 *
 * Modul ini tanpa dependensi server, jadi dipakai bersama oleh route handler
 * DAN pratinjau editor (`HalamanDocPreview`) agar keduanya identik.
 */
export const BACK_HOME_BUTTON_HTML = `<a class="hb-back-home" href="/" aria-label="Kembali ke beranda situs" title="Kembali ke beranda situs">
  <span class="hb-back-home__icon" aria-hidden="true">&#8592;</span>
  <span class="hb-back-home__label">Kembali ke Beranda</span>
</a>
<style>
.hb-back-home{position:fixed;left:16px;bottom:16px;z-index:2147483000;display:inline-flex;align-items:center;gap:8px;padding:10px 14px;border-radius:999px;background:#163c32;color:#fff;font:600 14px/1 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;text-decoration:none;box-shadow:0 12px 28px -10px rgba(0,0,0,.45);opacity:.92;transition:opacity .2s ease,transform .2s ease}
.hb-back-home:hover{opacity:1;transform:translateY(-2px)}
.hb-back-home:focus-visible{opacity:1;outline:3px solid #245447;outline-offset:3px}
.hb-back-home__icon{font-size:16px;line-height:1}
.hb-back-home__label{max-width:0;overflow:hidden;white-space:nowrap;transition:max-width .25s ease}
.hb-back-home:hover .hb-back-home__label,.hb-back-home:focus-visible .hb-back-home__label{max-width:200px}
@media (prefers-reduced-motion:reduce){.hb-back-home,.hb-back-home__label{transition:none}}
</style>`;

/** Sisipkan tombol kembali ke dalam sebuah dokumen HTML. */
export function injectBackHomeButton(html: string): string {
  const lower = html.toLowerCase();

  const bodyClose = lower.lastIndexOf("</body>");
  if (bodyClose !== -1) {
    return html.slice(0, bodyClose) + BACK_HOME_BUTTON_HTML + html.slice(bodyClose);
  }

  const htmlClose = lower.lastIndexOf("</html>");
  if (htmlClose !== -1) {
    return html.slice(0, htmlClose) + BACK_HOME_BUTTON_HTML + html.slice(htmlClose);
  }

  return html + BACK_HOME_BUTTON_HTML;
}