import type { ReactNode } from "react";
import Script from "next/script";

import { ContentRefresh } from "@/components/site/content-refresh";

const GTM_ID = "GTM-PNL4WS9Z";

/**
 * Layout grup route publik.
 *
 * Sengaja tidak merender kerangka apa pun selain `children`: semua halaman
 * publik memakai root `.hb2d1n` dengan modifier sendiri, sedangkan header/footer
 * juga berada DI DALAM wrapper itu (selector CSS-nya `.hb2d1n .site-footer`).
 * Jadi kerakasnya dirakit per halaman lewat `PublicShell`.
 *
 * `ContentRefresh` hanya menempelkan pemantau versi konten (tanpa markup) agar
 * tab yang sudah terbuka ikut memperbarui diri setelah admin menyimpan.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Script id="gtm-base" strategy="beforeInteractive">
        {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`}
      </Script>
      <noscript>
        <iframe
          src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
          height="0"
          width="0"
          style={{ display: "none", visibility: "hidden" }}
        />
      </noscript>
      {children}
      <ContentRefresh />
    </>
  );
}
