"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";

type GalleryNav = {
  pending: boolean;
  /** Teks status untuk pembaca layar selama navigasi. */
  announce: string | null;
  go: (href: string, announce?: string) => void;
};

const GalleryNavContext = createContext<GalleryNav | null>(null);

/**
 * Navigasi antarhalaman galeri lewat `startTransition`.
 *
 * Tanpa transisi, `router.push` menahan layar pada halaman lama sampai RSC
 * halaman tujuan selesai dimuat. Dengan transisi, `pending` langsung bernilai
 * true begitu link diklik, sehingga grid bisa diganti skeleton lebih dulu.
 */
export function GalleryNavProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [announce, setAnnounce] = useState<string | null>(null);

  const go = useCallback(
    (href: string, message?: string) => {
      setAnnounce(message ?? null);
      startTransition(() => {
        router.push(href);
      });
    },
    [router],
  );

  const value = useMemo(() => ({ pending, announce, go }), [pending, announce, go]);

  return (
    <GalleryNavContext.Provider value={value}>
      {children}
      {/* Live region selalu ada di DOM supaya teksnya benar-benar dibacakan. */}
      <p className="admin-status" role="status" aria-live="polite">
        {pending ? (announce ?? "Memuat gambar…") : ""}
      </p>
    </GalleryNavContext.Provider>
  );
}

export function useGalleryNav(): GalleryNav {
  const context = useContext(GalleryNavContext);
  if (!context) throw new Error("useGalleryNav harus dipakai di dalam GalleryNavProvider.");
  return context;
}

/**
 * Ganti grid dengan skeleton selama navigasi. Jumlah kartu disamakan dengan
 * `per` supaya tinggi grid tidak melompat jauh saat konten asli datang.
 */
export function GallerySkeletonGate({
  count,
  children,
}: {
  count: number;
  children: ReactNode;
}) {
  const { pending } = useGalleryNav();
  if (!pending) return <>{children}</>;

  return (
    <div className="admin-media-grid" aria-hidden="true">
      {Array.from({ length: Math.max(count, 1) }, (_, index) => (
        <div className="admin-media-skeleton" key={index}>
          <div className="admin-media-skeleton__thumb" />
          <div className="admin-media-skeleton__body">
            <span className="admin-media-skeleton__line" />
            <span className="admin-media-skeleton__line admin-media-skeleton__line--short" />
            <span className="admin-media-skeleton__line admin-media-skeleton__line--tiny" />
            <span className="admin-media-skeleton__action" />
          </div>
        </div>
      ))}
    </div>
  );
}
