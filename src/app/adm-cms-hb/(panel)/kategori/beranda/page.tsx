import { LiveEditor } from "@/components/admin/live-editor";
import { homeSections } from "@/lib/admin/home-fields";
import { homePreviewBase } from "@/lib/admin/preview-base";
import { requireSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

import { saveHomeAction } from "./actions";

export const dynamic = "force-dynamic";

/**
 * Management beranda, diletakkan di bawah menu Kategori.
 *
 * Tidak ada menu sidebar sendiri: dari `/adm-cms-hb/kategori` ada entri "Beranda",
 * dan form ini memakai editor dua kolom yang sama seperti kategori dan paket.
 */
export default async function EditHomePage({
  searchParams,
}: {
  searchParams: Promise<{ tersimpan?: string }>;
}) {
  await requireSessionUser();

  const { tersimpan } = await searchParams;

  const [preview, stats, benefits, testimonials] = await Promise.all([
    homePreviewBase(),
    prisma.homeStat.findMany({ orderBy: { order: "asc" } }),
    prisma.benefit.findMany({
      where: { isHomepage: true },
      orderBy: { order: "asc" },
      select: { id: true, icon: true, title: true, description: true, order: true },
    }),
    prisma.testimonial.findMany({ orderBy: { order: "asc" } }),
  ]);

  if (!preview) throw new Error("SiteSettings belum diisi. Jalankan `pnpm db:seed`.");

  const initial = {
    ...preview.base.settings,
    stats: stats.map((stat) => ({ num: stat.num, label: stat.label })),
    benefits: benefits.map((benefit) => ({
      icon: benefit.icon,
      title: benefit.title,
      description: benefit.description,
    })),
    testimonials: testimonials.map((testimonial) => ({
      stars: testimonial.stars,
      quote: testimonial.quote,
      author: testimonial.author,
      location: testimonial.location,
    })),
    gallery: (preview.base.gallery ?? []).map((image) => ({ url: image.url, alt: image.alt })),
  };

  return (
    <>
      {tersimpan ? (
        <p className="admin-notice" role="status">
          Beranda tersimpan.
        </p>
      ) : null}

      <LiveEditor
        title="Beranda"
        backHref="/adm-cms-hb/kategori"
        backLabel="Semua kategori"
        sections={homeSections}
        initial={initial}
        action={saveHomeAction}
        submitLabel="Simpan beranda"
        preview={{ kind: "home", ...preview }}
      />

      <p className="admin-hint">
        Kartu <strong>Tipe Trip</strong> diambil dari tiap kategori, dan <strong>Paket Favorit</strong>{" "}
        dari paket yang ditandai “Tampilkan di beranda”. Keduanya disunting di halamannya masing-masing.
        Blok <strong>Ajakan Booking</strong> juga dipakai di semua halaman paket.
      </p>
    </>
  );
}