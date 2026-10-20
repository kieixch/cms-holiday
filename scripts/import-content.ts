/**
 * Impor `content/content.json` (hasil `pnpm extract`) ke database.
 * Aman dijalankan berulang: konten lama dibersihkan dulu, lalu ditulis ulang.
 *
 * Jalankan: pnpm import
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { prisma } from "../src/lib/db";
import type { Prisma } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/password";
import { categoryHero } from "./category-heroes";
import type { ContentFile } from "./content-types";

const CONTENT_FILE = resolve(process.cwd(), "content", "content.json");

const content = JSON.parse(
  readFileSync(CONTENT_FILE, "utf8"),
) as ContentFile;

/** Hero/CTA pada HTML menyimpan anchor sebagai "#paket". */
const anchor = (href: string | null | undefined, fallback: string) => {
  const v = (href ?? "").trim();
  if (!v) return fallback;
  return v.startsWith("#") ? v.slice(1) : v;
};

/** Ambil pesan prasetel dari link wa.me, mis. "...?text=Hai%20Holiday". */
const waMessage = (href: string | null | undefined) => {
  const m = (href ?? "").match(/[?&]text=([^&]*)/);
  if (!m) return "";
  try {
    return decodeURIComponent(m[1].replace(/\+/g, " "));
  } catch {
    return m[1];
  }
};

async function wipe() {
  // Urutan tidak penting selama foreign key memakai onDelete: Cascade,
  // tapi AdminUser dibiarkan utuh agar tidak kehilangan akun.
  await prisma.priceValue.deleteMany();
  await prisma.priceColumn.deleteMany();
  await prisma.priceRow.deleteMany();
  await prisma.priceItem.deleteMany();
  await prisma.timelineItem.deleteMany();
  await prisma.itineraryDay.deleteMany();
  await prisma.packageSchedule.deleteMany();
  await prisma.facilityItem.deleteMany();
  await prisma.facilityGroup.deleteMany();
  await prisma.galleryImage.deleteMany();
  await prisma.packageNote.deleteMany();
  await prisma.facilityPill.deleteMany();
  await prisma.cardDay.deleteMany();
  await prisma.cardPrice.deleteMany();
  await prisma.pricing.deleteMany();
  await prisma.package.deleteMany();
  await prisma.benefit.deleteMany();
  await prisma.category.deleteMany();
  await prisma.testimonial.deleteMany();
  await prisma.homeStat.deleteMany();
  await prisma.homeGalleryImage.deleteMany();
  await prisma.htmlPage.deleteMany();
}

async function seedSettings() {
  const s = content.settings;
  await prisma.siteSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...s },
    update: s,
  });
}

async function seedHome() {
  await prisma.homeStat.createMany({
    data: content.homeStats.map((st, i) => ({
      num: st.num,
      label: st.label,
      order: i,
    })),
  });

  await prisma.testimonial.createMany({
    data: content.testimonials.map((t, i) => ({
      stars: t.stars,
      quote: t.quote,
      author: t.author,
      location: t.location,
      order: i,
    })),
  });

  await prisma.benefit.createMany({
    data: content.homeBenefits.map((b, i) => ({
      isHomepage: true,
      icon: b.icon,
      title: b.title,
      description: b.description,
      order: i,
    })),
  });

  const gallery = content.homeGallery ?? [];
  if (gallery.length > 0) {
    await prisma.homeGalleryImage.createMany({
      data: gallery.map((g, i) => ({ url: g.url, alt: g.alt, order: i })),
    });
  }
}

async function seedCategories() {
  const bySlug = new Map<string, string>();

  for (const cat of content.categories) {
    const hero = cat.hero;
    const cta = cat.cta;
    const listing = cat.listing;
    const note = cat.note;
    const ben = cat.benefits;

    const created = await prisma.category.create({
      data: {
        slug: cat.slug,
        name: cat.navLabel,
        navLabel: cat.navLabel,
        kind: cat.kind,
        duration: cat.duration ?? "",
        order: cat.order,
        showInNav: cat.showInNav ?? true,
        isPublished: cat.isPublished ?? true,

        heroBadges: hero?.badges ?? [],
        heroTitle: hero?.title ?? cat.navLabel,
        heroAccent: hero?.accent ?? "",
        heroSuffix: hero?.suffix ?? "",
        heroDescription: hero?.description ?? "",
        heroDecos: hero?.decos ?? [],
        // `content.json` hasil `pnpm extract` tidak memuat gambar hero kategori;
        // gambar-gambar itu dipasang `categoryHero()`. Kalau file datang dari
        // export editor, kolom gambar sudah ada dan harus menang — termasuk
        // saat admin mengosongkannya.
        ...(hero && "image" in hero
          ? { heroImage: hero.image ?? null, heroImageAlt: hero.imageAlt ?? null }
          : categoryHero(cat.slug)),
        ctaPrimaryLabel: hero?.ctaPrimaryLabel ?? "",
        ctaSecondaryLabel: hero?.ctaSecondaryLabel ?? "",
        ctaSecondaryAnchor: anchor(hero?.ctaSecondaryHref, "paket"),
        heroWaLink: hero?.primaryLink ?? "",
        ctaTitle: cta?.title ?? "",
        ctaText: cta?.text ?? "",
        ctaLabel: cta?.label ?? "",
        ctaMessage: waMessage(cta?.href),
        ctaWaLink: cta?.link ?? "",
        ctaBackground: cta?.background ?? null,
        waNumber: cat.whatsapp?.number ?? "",
        waGreeting: cat.whatsapp?.greeting ?? "",
        waMessage: cat.whatsapp?.message ?? "",
        ctaWaNumber: cat.whatsapp?.ctaNumber ?? "",
        ctaWaGreeting: cat.whatsapp?.ctaGreeting ?? "",

        listingTag: listing?.tag ?? "",
        listingTitle: listing?.title ?? "",
        listingAccent: listing?.accent ?? "",
        listingSuffix: listing?.suffix ?? "",
        listingDescription: listing?.description ?? "",
        listingAnchor: listing?.anchor ?? "paket",
        listingNoteIcon: note?.icon ?? null,
        listingNoteText: note?.text ?? null,
        gridColumns: listing?.gridColumns ?? 3,

        benefitsTag: ben?.tag ?? "",
        benefitsTitle: ben?.title ?? "",
        benefitsAccent: ben?.accent ?? "",
        benefitsSuffix: ben?.suffix ?? "",
        benefitsDescription: ben?.description ?? "",

        pgAnchor: cat.pages?.anchor ?? "halaman",
        pgTag: cat.pages?.tag ?? "",
        pgTitle: cat.pages?.title ?? "",
        pgAccent: cat.pages?.accent ?? "",
        pgSuffix: cat.pages?.suffix ?? "",
        pgDesc: cat.pages?.description ?? "",

        cardIcon: cat.cardIcon ?? "",
        cardDescription: cat.cardDescription ?? "",
        cardPrice: cat.cardPrice ?? "",
        cardLinkLabel: cat.cardLinkLabel ?? "",
        cardImage: cat.cardImage ?? null,
        cardImageAlt: cat.cardImageAlt ?? null,
      },
    });

    bySlug.set(cat.slug, created.id);

    const items = ben?.items ?? [];
    if (items.length > 0) {
      await prisma.benefit.createMany({
        data: items.map((b, i) => ({
          categoryId: created.id,
          isHomepage: false,
          icon: b.icon,
          title: b.title,
          description: b.description,
          order: i,
        })),
      });
    }
  }

  return bySlug;
}

async function seedPackages(categoryIds: Map<string, string>) {
  for (const pkg of content.packages) {
    const categoryId = categoryIds.get(pkg.categorySlug);
    if (!categoryId) {
      throw new Error(
        `Kategori "${pkg.categorySlug}" untuk paket "${pkg.slug}" tidak ditemukan.`,
      );
    }

    const card = pkg.card;
    const hero = pkg.hero;
    const cta = pkg.cta;
    const itin = pkg.itinerary;
    const schedule = pkg.schedule ?? null;
    const fas = pkg.facilities;
    const pricing = pkg.pricing;
    const gallery = pkg.gallery;
    const note = pkg.note;
    const cardDays = card?.days ?? [];
    const cardPills = card?.facilityPills ?? [];
    const galleryImages = gallery?.images ?? [];

    const created = await prisma.package.create({
      data: {
        slug: pkg.slug,
        name: pkg.name,
        categoryId,
        kind: pkg.kind,
        isPublished: pkg.isPublished ?? true,
        hasDetailPage: pkg.hasDetailPage,
        isFeatured: pkg.isFeatured,
        showOnHome: pkg.showOnHome,
        order: pkg.order ?? 0,

        cardImage: card?.image ?? null,
        cardImageAlt: card?.imageAlt ?? "",
        cardLoc: card?.loc ?? null,
        cardHomeLoc: card?.homeLoc ?? null,
        cardTag: card?.tag ?? null,
        cardRating: card?.rating ?? null,
        cardHighlight: card?.highlight ?? null,
        cardPriceLabel: card?.priceLabel ?? null,
        cardPriceValue: card?.priceValue ?? null,
        cardPriceUnit: card?.priceUnit ?? null,
        cardButtonLabel: card?.buttonLabel ?? "",
        cardWaLink: card?.waLink ?? null,
        cardLinkMode: card?.isWhatsappLink ? "whatsapp" : "detail",
        cardVariant: pkg.cardVariant,

        heroBadges: hero?.badges ?? [],
        heroTitle: hero?.title ?? pkg.name,
        heroAccent: hero?.accent ?? "",
        heroSuffix: hero?.suffix ?? "",
        heroDescription: hero?.description ?? "",
        heroDecos: hero?.decos ?? [],
        // Hanya diisi kalau file export memang membawa gambar hero; `pnpm
        // extract` tidak, sehingga renderer tetap jatuh ke foto galeri pertama.
        ...(hero && "image" in hero
          ? { heroImage: hero.image ?? null, heroImageAlt: hero.imageAlt ?? null }
          : {}),
        ctaPrimaryLabel: hero?.ctaPrimaryLabel ?? "",
        ctaSecondaryLabel: hero?.ctaSecondaryLabel ?? "",
        ctaSecondaryAnchor: anchor(hero?.ctaSecondaryHref, "itinerary"),
        heroWaLink: hero?.primaryLink ?? "",
        ctaTitle: cta?.title ?? "",
        ctaText: cta?.text ?? "",
        ctaLabel: cta?.label ?? "",
        ctaMessage: waMessage(cta?.href),
        ctaWaLink: cta?.link ?? "",
        ctaBackground: cta?.background ?? null,
        waMessage: pkg.waMessage,
        waNumber: pkg.whatsapp?.number ?? "",
        waGreeting: pkg.whatsapp?.greeting ?? "",
        ctaWaNumber: pkg.whatsapp?.ctaNumber ?? "",
        ctaWaGreeting: pkg.whatsapp?.ctaGreeting ?? "",

        jadwalTag: schedule?.tag ?? "Jadwal",
        jadwalTitle: schedule?.title ?? "Jadwal",
        jadwalAccent: schedule?.accent ?? "Keberangkatan",
        jadwalSuffix: schedule?.suffix ?? "",
        jadwalDescription: schedule?.description ?? "",
        jadwalAnchor: schedule?.anchor ?? "jadwal",

        itineraryTag: itin?.tag ?? "",
        itineraryTitle: itin?.title ?? "",
        itineraryAccent: itin?.accent ?? "",
        itinerarySuffix: itin?.suffix ?? "",
        itineraryDescription: itin?.description ?? "",
        itineraryAnchor: itin?.anchor ?? "itinerary",
        itineraryColumns: itin?.gridColumns ?? 1,

        facilityTag: fas?.tag ?? "",
        facilityTitle: fas?.title ?? "",
        facilityAccent: fas?.accent ?? "",
        facilitySuffix: fas?.suffix ?? "",
        facilityDescription: fas?.description ?? "",

        pricingTag: pricing?.tag ?? "",
        pricingTitle: pricing?.title ?? "",
        pricingAccent: pricing?.accent ?? "",
        pricingSuffix: pricing?.suffix ?? "",
        pricingDescription: pricing?.description ?? "",

        galleryTag: gallery?.tag ?? "",
        galleryTitle: gallery?.title ?? "",
        galleryAccent: gallery?.accent ?? "",
        gallerySuffix: gallery?.suffix ?? "",
        galleryDescription: gallery?.description ?? "",
        galleryColumns: gallery?.gridColumns ?? 3,
        galleryHasMore: pkg.galleryHasMore ?? false,
        galleryMoreLabel: pkg.galleryMoreLabel ?? "Lihat Selengkapnya",

        images: galleryImages.map((g) => g.url),
      },
    });

    if (note?.text) {
      await prisma.packageNote.create({
        data: {
          packageId: created.id,
          icon: note.icon || "ℹ️",
          text: note.text,
          order: 0,
        },
      });
    }

    if (cardDays.length > 0) {
      await prisma.cardDay.createMany({
        data: cardDays.map((d, i) => ({
          packageId: created.id,
          label: d.label,
          title: d.title,
          order: i,
        })),
      });
    }

    if (cardPills.length > 0) {
      await prisma.facilityPill.createMany({
        data: cardPills.map((f, i) => ({
          packageId: created.id,
          label: f,
          order: i,
        })),
      });
    }

    const scheduleItems = schedule?.items ?? [];
    if (scheduleItems.length > 0) {
      await prisma.packageSchedule.createMany({
        data: scheduleItems.map((s, i) => ({
          packageId: created.id,
          // String() agar file konten lama yang masih menyimpan angka tetap masuk.
          day: String(s.day),
          month: s.month,
          year: String(s.year),
          description: s.description ?? "",
          order: i,
        })),
      });
    }

    const cardPrices = card?.prices ?? [];
    if (cardPrices.length > 0) {
      await prisma.cardPrice.createMany({
        data: cardPrices.map((p, i) => ({
          packageId: created.id,
          label: p.label,
          value: p.value,
          unit: p.unit || null,
          order: i,
        })),
      });
    }

    for (const [di, day] of (itin?.days ?? []).entries()) {
      const createdDay = await prisma.itineraryDay.create({
        data: {
          packageId: created.id,
          emoji: day.emoji || "🌴",
          label: day.label,
          title: day.title,
          order: di,
        },
      });
      if (day.items.length > 0) {
        await prisma.timelineItem.createMany({
          data: day.items.map((it, i) => ({
            dayId: createdDay.id,
            time: it.time,
            text: it.text,
            order: i,
          })),
        });
      }
    }

    for (const [gi, group] of (fas?.groups ?? []).entries()) {
      const createdGroup = await prisma.facilityGroup.create({
        data: {
          packageId: created.id,
          variant: group.variant,
          title: group.title,
          order: gi,
        },
      });
      if (group.items.length > 0) {
        await prisma.facilityItem.createMany({
          data: group.items.map((it, i) => ({
            groupId: createdGroup.id,
            icon: it.icon,
            text: it.text,
            order: i,
          })),
        });
      }
    }

    if (pricing) {
      const createdPricing = await prisma.pricing.create({
        data: {
          packageId: created.id,
          kind: pricing.kind,
          note: pricing.note || null,
          rowHeaderLabel: pricing.firstHeader || null,
        },
      });

      if (pricing.kind === "TABLE") {
        const columns = pricing.columns;
        const columnIds: string[] = [];
        for (const [ci, col] of columns.entries()) {
          const cssClass = col.cssClass ?? pricing.rows[0]?.cells[ci]?.cssClass ?? null;
          const createdColumn = await prisma.priceColumn.create({
            data: {
              pricingId: createdPricing.id,
              label: col.label,
              cssClass,
              order: ci,
            },
          });
          columnIds.push(createdColumn.id);
        }
        for (const [ri, row] of pricing.rows.entries()) {
          const createdRow = await prisma.priceRow.create({
            data: {
              pricingId: createdPricing.id,
              label: row.label,
              order: ri,
            },
          });
          for (const [ci, cell] of row.cells.entries()) {
            const columnId = columnIds[ci];
            if (!columnId) continue;
            await prisma.priceValue.create({
              data: {
                rowId: createdRow.id,
                columnId,
                value: cell.value,
              },
            });
          }
        }
      } else {
        await prisma.priceItem.createMany({
          data: pricing.items.map((it, i) => ({
            pricingId: createdPricing.id,
            label: it.label,
            value: it.value,
            unit: it.unit || null,
            order: i,
          })),
        });
      }
    }

    if (galleryImages.length > 0) {
      await prisma.galleryImage.createMany({
        data: galleryImages.map((g, i) => ({
          packageId: created.id,
          url: g.url,
          alt: g.alt,
          order: i,
        })),
      });
    }
  }
}

/** Halaman HTML mandiri. `content.pages` opsional (file lama tanpa fitur ini). */
async function seedPages() {
  const pages = content.pages ?? [];
  if (pages.length === 0) return;

  await prisma.htmlPage.createMany({
    data: pages.map((page, index) => ({
      slug: page.slug,
      title: page.title,
      html: page.html,
      ...(page.bio
        ? { bio: page.bio as unknown as Prisma.InputJsonValue }
        : {}),
      scope: page.scope ?? "page",
      showOnHome: page.showOnHome ?? false,
      categorySlugs: page.categorySlugs ?? [],
      cardImage: page.cardImage ?? null,
      cardTag: page.cardTag ?? "",
      cardTitle: page.cardTitle ?? "",
      cardDesc: page.cardDesc ?? "",
      cardButtonLabel: page.cardButtonLabel ?? "",
      isPublished: page.isPublished ?? true,
      order: page.order ?? index,
    })),
  });
}

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.log(
      "  - ADMIN_EMAIL/ADMIN_PASSWORD belum diisi, akun admin dilewati.",
    );
    return;
  }
  if (password.startsWith("ganti-")) {
    console.log(
      "  - ADMIN_PASSWORD masih nilai contoh, akun admin dilewati. Ganti dulu di .env.",
    );
    return;
  }

  await prisma.adminUser.upsert({
    where: { email },
    create: {
      email,
      name: "Administrator",
      passwordHash: await hashPassword(password),
    },
    update: {},
  });
  console.log(`  - admin: ${email}`);
}

async function main() {
  console.log(`Sumber  : ${CONTENT_FILE}`);

  await wipe();
  await seedSettings();
  await seedHome();
  const categoryIds = await seedCategories();
  await seedPackages(categoryIds);
  await seedPages();
  await seedAdmin();

  const [catCount, pkgCount, itinCount, priceCount, galCount, pageCount] =
    await Promise.all([
      prisma.category.count(),
      prisma.package.count(),
      prisma.itineraryDay.count(),
      prisma.pricing.count(),
      prisma.galleryImage.count(),
      prisma.htmlPage.count(),
    ]);

  console.log("\nSelesai:");
  console.log(`  kategori        : ${catCount}`);
  console.log(`  paket           : ${pkgCount}`);
  console.log(`  hari itinerary  : ${itinCount}`);
  console.log(`  tabel harga     : ${priceCount}`);
  console.log(`  gambar galeri   : ${galCount}`);
  console.log(`  halaman HTML    : ${pageCount}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
