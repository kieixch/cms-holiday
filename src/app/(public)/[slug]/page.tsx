import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { JsonLd } from "@/components/site/json-ld";
import { PublicShell } from "@/components/site/public-shell";
import { InactivePackageNotice } from "@/components/site/inactive-package";
import { CategoryBody, PackageBody } from "@/components/site/views";
import {
  absoluteUrl,
  breadcrumbList,
  itemList,
  metaDescription,
  organizationGraph,
  pageOpenGraph,
  pageTwitter,
  SITE_DESCRIPTION,
  touristTrip,
} from "@/lib/seo";
import {
  getCategoryPage,
  getInactivePackage,
  getNavItems,
  getPackagePage,
  getPublicSlugs,
  getSettings,
} from "@/lib/site";

/**
 * Semua URL legacy bersifat flat di root (`/open-trip-banyuwangi/`,
 * `/paket-trip-bluefire-kawahijen/`), jadi satu rute ini melayani dua jenis
 * halaman: kategori dicek lebih dulu, lalu paket.
 *
 * Markup-nya dirender oleh `<CategoryBody>` / `<PackageBody>` di
 * `@/components/site/views` — komponen yang sama dipakai live preview panel
 * admin, jadi perubahan di sini langsung terlihat di preview dan sebaliknya.
 */
export const revalidate = 3600;

export async function generateStaticParams() {
  const slugs = await getPublicSlugs();
  return slugs.map((slug) => ({ slug }));
}

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const [category, pkg] = await Promise.all([getCategoryPage(slug), getPackagePage(slug)]);
  if (category) {
    const title = category.heroTitle || category.navLabel;
    const desc = metaDescription(category.heroDescription, SITE_DESCRIPTION);
    const path = `/${slug}`;
    return {
      title,
      description: desc,
      alternates: { canonical: absoluteUrl(path) },
      openGraph: pageOpenGraph({ title, description: desc, path }),
      twitter: pageTwitter({ title, description: desc }),
    };
  }
  if (pkg) {
    const title = pkg.heroTitle || pkg.name;
    const desc = metaDescription(pkg.heroDescription, SITE_DESCRIPTION);
    const path = `/${slug}`;
    return {
      title,
      description: desc,
      alternates: { canonical: absoluteUrl(path) },
      openGraph: pageOpenGraph({ title, description: desc, path }),
      twitter: pageTwitter({ title, description: desc }),
    };
  }
  const inactive = await getInactivePackage(slug);
  if (inactive) return { title: `Belum aktif — ${inactive.name}`, robots: { index: false, follow: false } };
  return {};
}

export default async function SlugPage({ params }: PageProps) {
  const { slug } = await params;
  const [settings, nav, category, pkg] = await Promise.all([
    getSettings(),
    getNavItems(),
    getCategoryPage(slug),
    getPackagePage(slug),
  ]);

  if (!settings) throw new Error("SiteSettings belum diisi. Jalankan `pnpm db:seed`.");

  const footer = {
    siteUrl: settings.siteUrl,
    email: settings.email,
    instagram: settings.instagram,
    tiktok: settings.tiktok,
    footerText: settings.footerText,
    footerHeading: settings.footerHeading,
    copyrightText: settings.copyrightText,
    footerMadeWith: settings.footerMadeWith,
    footerLocation: settings.footerLocation,
    footerHeart: settings.footerHeart,
  };

  if (category) {
    const path = `/${slug}`;
    const items = category.packages.map((p) => ({ name: p.name, path: `/${p.slug}` }));
    return (
      <>
        <JsonLd data={organizationGraph(settings)} />
        <JsonLd data={breadcrumbList([{ name: "Beranda", path: "/" }, { name: category.navLabel || category.heroTitle, path }])} />
        <JsonLd data={itemList(category.listingTitle || category.navLabel, items)} />
        <PublicShell
          variant={category.kind === "OPEN_TRIP" ? "opentrip" : "category"}
          waNumber={settings.waNumber}
          waMessage={settings.waMessage}
          waGreeting={settings.waGreeting}
          stickyWaLabel={settings.stickyWaLabel}
          stickyWaLink={settings.stickyWaLink}
          nav={nav}
          footer={footer}
        >
          <CategoryBody
            category={category}
            waNumber={settings.waNumber}
            waMessage={settings.waMessage}
            waGreeting={settings.waGreeting}
            ctaBackground={settings.ctaBackground}
            pages={category.pages}
          />
        </PublicShell>
      </>
    );
  }
  if (pkg) {
    const path = `/${slug}`;
    const image = pkg.heroImage || pkg.cardImage;
    return (
      <>
        <JsonLd data={organizationGraph(settings)} />
        <JsonLd
          data={breadcrumbList([
            { name: "Beranda", path: "/" },
            { name: pkg.category.navLabel, path: `/${pkg.category.slug}` },
            { name: pkg.name, path },
          ])}
        />
        <JsonLd
          data={touristTrip({
            name: pkg.name,
            description: pkg.heroDescription || `${pkg.name} — paket tour Banyuwangi`,
            path,
            image: image ?? undefined,
          })}
        />
        <PublicShell
          variant="package"
          waNumber={settings.waNumber}
          waMessage={settings.waMessage}
          waGreeting={settings.waGreeting}
          stickyWaLabel={settings.stickyWaLabel}
          stickyWaLink={settings.stickyWaLink}
          nav={nav}
          footer={footer}
        >
          <PackageBody
            pkg={pkg}
            waNumber={settings.waNumber}
            waMessage={settings.waMessage}
            waGreeting={settings.waGreeting}
            ctaBackground={settings.ctaBackground}
          />
        </PublicShell>
      </>
    );
  }

  /**
   * Paket yang ada tapi belum aktif (draft / belum punya halaman detail) tidak
   * di-404-kan buta. Selama admin sedang mengira-ngira kenapa "Lihat" gagal,
   * halaman ini menjelaskan sebabnya dan menyediakan jalan kembali ke panel.
   * Slug yang benar-benar tidak ada tetap jatuh ke `notFound()`.
   */
  const inactive = await getInactivePackage(slug);
  if (inactive) {
    return (
      <PublicShell
        variant="category"
        waNumber={settings.waNumber}
        waMessage={settings.waMessage}
        waGreeting={settings.waGreeting}
        stickyWaLabel={settings.stickyWaLabel}
        stickyWaLink={settings.stickyWaLink}
        nav={nav}
        footer={footer}
      >
        <InactivePackageNotice pkg={inactive} />
      </PublicShell>
    );
  }
  notFound();
}