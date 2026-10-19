import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BioLinkPage } from "@/components/site/bio-link-page";
import { normalizeBio } from "@/lib/bio";
import { absoluteUrl } from "@/lib/seo";
import { prisma } from "@/lib/db";

// ISR 1 jam: halaman bio tidak memakai API dinamis (cookies/headers), dan
// `revalidatePath("/bio/<slug>")` sudah dipanggil `admin/sosmed/actions.ts`
// saat admin menyimpan/menghapus — perubahan tampil tanpa menunggu jatuh tempo.
//
// `generateStaticParams` wajib: docs ISR Next menyebut fungsi inilah yang
// mengaktifkan ISR untuk route dinamis — tanpa route tetap `force-dynamic`.
// Slug yang dibuat setelah build (admin bikin bio baru) tetap dirender
// on-demand (`dynamicParams` default true) lalu masuk cache.
export const revalidate = 3600;

export async function generateStaticParams() {
  const pages = await prisma.htmlPage.findMany({
    where: { scope: "sosmed", isPublished: true },
    select: { slug: true },
  });
  return pages.map((page) => ({ slug: page.slug }));
}

/**
 * Halaman link-bio (Instagram/TikTok) dari panel admin (`/adm-cms-hb/sosmed`).
 *
 * Dulu route handler yang mengirim kolom `html` apa adanya. Sekarang halaman
 * native React: konten dibaca dari kolom terstruktur `HtmlPage.bio` dan
 * dirender `<BioLinkPage>`, jadi ikut pipeline framework (font, CSP, hidrasi)
 * alih-alih dokumen HTML yang ditempel mentah.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await prisma.htmlPage.findUnique({
    where: { slug },
    select: { title: true, scope: true, isPublished: true, bio: true },
  });
  if (!page || page.scope !== "sosmed" || !page.isPublished) return {};
  const bio = normalizeBio(page.bio);
  return {
    title: page.title,
    // Link-bio dirancang untuk trafik Instagram/TikTok, bukan pencarian:
    // isinya mayoritas duplikat halaman paket/kategori, jadi noindex
    // mencegah Google menganggap situs ini penuh halaman duplikat
    // (panda/dilusi), sementara pengunjung dari bio tetap mendarat normal.
    robots: { index: false, follow: true },
    description: bio.subtitle || undefined,
    alternates: { canonical: absoluteUrl(`/bio/${slug}`) },
  };
}

export default async function BioLinkRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const page = await prisma.htmlPage.findUnique({ where: { slug } });

  if (!page || page.scope !== "sosmed" || !page.isPublished) {
    notFound();
  }

  return <BioLinkPage data={normalizeBio(page.bio)} />;
}
