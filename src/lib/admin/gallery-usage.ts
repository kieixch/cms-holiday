import { prisma } from "@/lib/db";

/**
 * Di mana sebuah URL gambar dipakai di konten publik.
 *
 * R2 tidak punya versioning, jadi `remove` tidak bisa dibatalkan. Karena itu
 * hapus aset dicek dulu: kalau URL masih dipakai di kartu paket, galeri paket,
 * atau salah satu gambar kategori (latar hero / kartu di beranda), penghapusan
 * ditolak dan lokasinya dikembalikan ke admin supaya gambarnya dilepas dari
 * sana lebih dulu.
 *
 * Dipisah dari `actions.ts` karena bukan Server Action: halaman detail satu
 * aset juga butuh menampilkan pemakaian yang sama.
 */
export async function findImageUsage(url: string) {
  const [packages, galleries, categories] = await Promise.all([
    prisma.package.findMany({
      where: { OR: [{ cardImage: url }, { heroImage: url }, { images: { has: url } }] },
      select: { slug: true, name: true, cardImage: true, heroImage: true },
      take: 6,
    }),
    prisma.galleryImage.findMany({
      where: { url },
      select: { package: { select: { slug: true, name: true } } },
      take: 6,
    }),
    prisma.category.findMany({
      where: { OR: [{ heroImage: url }, { cardImage: url }] },
      select: { slug: true, name: true, heroImage: true, cardImage: true },
      take: 6,
    }),
  ]);

  const places = [
    // Paket bisa memakai URL yang sama di beberapa tempat (kartu / latar hero),
    // jadi tiap field dilaporkan terpisah supaya admin tahu melepas yang mana.
    ...packages.flatMap((p) => [
      ...(p.cardImage === url
        ? [{ where: `Paket ${p.name} — kartu`, href: `/adm-cms-hb/paket/${p.slug}` }]
        : []),
      ...(p.heroImage === url
        ? [{ where: `Paket ${p.name} — latar hero`, href: `/adm-cms-hb/paket/${p.slug}` }]
        : []),
    ]),
    ...galleries.map((g) => ({
      where: `Galeri Paket ${g.package.name}`,
      href: `/adm-cms-hb/paket/${g.package.slug}`,
    })),
    // Satu kategori bisa memakai URL yang sama untuk dua field, jadi setiap
    // field dilaporkan terpisah supaya admin tahu melepasnya di mana.
    ...categories.flatMap((c) => [
      ...(c.heroImage === url
        ? [{ where: `Kategori ${c.name} — latar hero`, href: `/adm-cms-hb/kategori/${c.slug}` }]
        : []),
      ...(c.cardImage === url
        ? [{ where: `Kategori ${c.name} — kartu beranda`, href: `/adm-cms-hb/kategori/${c.slug}` }]
        : []),
    ]),
  ];

  return { places, count: places.length };
}