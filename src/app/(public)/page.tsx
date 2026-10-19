import { PublicShell } from "@/components/site/public-shell";
import { HomeBody } from "@/components/site/views";
import { getHomePage, getNavItems } from "@/lib/site";

/**
 * Halaman beranda.
 *
 * Revalidasi 1 jam; penyimpanan dari panel admin nanti memanggil
 * `revalidatePath("/")` supaya perubahan tampil langsung.
 */
export const revalidate = 3600;

export default async function HomePage() {
  const [
    { settings, stats, benefits, testimonials, favorites, types, igPosts, igHasMore, pages, gallery },
    nav,
  ] = await Promise.all([getHomePage(), getNavItems()]);

  return (
    <PublicShell
      variant="home"
      waNumber={settings.waNumber}
      waMessage={settings.waMessage}
      waGreeting={settings.waGreeting}
      stickyWaLabel={settings.stickyWaLabel}
      stickyWaLink={settings.stickyWaLink}
      nav={nav}
      footer={{
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
      }}
    >
      <HomeBody
        settings={settings}
        stats={stats.map((s) => ({ num: s.num, label: s.label }))}
        benefits={benefits}
        testimonials={testimonials}
        favorites={favorites}
        types={types.map((t) => ({
          slug: t.slug,
          name: t.navLabel,
          icon: t.cardIcon,
          description: t.cardDescription,
          price: t.cardPrice,
          linkLabel: t.cardLinkLabel,
          image: t.cardImage,
          imageAlt: t.cardImageAlt,
        }))}
        igPosts={igPosts}
        igHasMore={igHasMore}
        pages={pages}
        gallery={gallery}
      />
    </PublicShell>
  );
}
