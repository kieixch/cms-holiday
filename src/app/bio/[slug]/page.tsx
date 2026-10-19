import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BioLinkPage } from "@/components/site/bio-link-page";
import { normalizeBio } from "@/lib/bio";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Halaman link-bio (Instagram/TikTok) dari panel admin (`/admin/sosmed`).
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
    select: { title: true, scope: true, isPublished: true },
  });
  if (!page || page.scope !== "sosmed" || !page.isPublished) return {};
  return { title: page.title };
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
