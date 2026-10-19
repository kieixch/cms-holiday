"use client";

import Image from "next/image";
import { useState } from "react";

import type { InstagramPostData } from "@/lib/instagram-feed";
import { safeHref } from "@/lib/wa";
import { InstagramGlyph } from "./instagram-glyph";

/**
 * Grid feed Instagram di beranda + tombol "Muat Lebih Banyak".
 *
 * Halaman beranda merender batch pertama (4 kolom × 2 baris = 8 postingan) di
 * server, lalu komponen ini menambah satu batch berikutnya per klik lewat
 * `/api/instagram-feed`. Jadi pengunjung tidak pernah menarik seluruh feed
 * sekaligus, dan tampilan awal tetap sama persis sebelum dan sesudah hidrasi.
 */

type Props = {
  initialPosts: InstagramPostData[];
  /** Masih ada postingan setelah batch pertama? Dihitung server saat render. */
  initialHasMore: boolean;
};

export function InstagramFeed({ initialPosts, initialHasMore }: Props) {
  const [posts, setPosts] = useState(initialPosts);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function loadMore() {
    if (loading) return;
    setLoading(true);
    setFailed(false);
    try {
      const res = await fetch(`/api/instagram-feed?offset=${posts.length}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        posts: InstagramPostData[];
        hasMore: boolean;
      };
      setPosts((prev) => [...prev, ...data.posts]);
      setHasMore(data.hasMore);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  if (posts.length === 0 && !hasMore) return null;

  return (
    <>
      <div className="hbgl-ig-grid">
        {posts.map((post) => (
          <a
            key={post.id}
            className="hbgl-ig-card"
            href={safeHref(post.permalink)}
            target="_blank"
            rel="noopener"
            title={post.caption}
          >
            {post.imageUrl ? (
              <Image
                className="hbgl-ig-card__img"
                src={post.imageUrl}
                alt={altOf(post.caption)}
                width={480}
                height={720}
                // URL media berasal dari CDN Instagram yang tidak terdaftar di
                // `images.remotePatterns`, jadi optimizer Next dilewati — sama
                // seperti kartu tipe trip di beranda.
                unoptimized
              />
            ) : (
              <span className="hbgl-ig-card__img hbgl-ig-card__placeholder" aria-hidden="true">
                📷
              </span>
            )}
            <span className="hbgl-ig-card__overlay" aria-hidden="true">
              <InstagramGlyph />
            </span>
          </a>
        ))}
      </div>

      {hasMore ? (
        <div className="hbgl-ig-more">
          <button
            type="button"
            className="hbgl-ig-more__btn"
            onClick={loadMore}
            disabled={loading}
          >
            {loading ? "Memuat…" : "Muat Lebih Banyak"}
          </button>
          {failed ? (
            <p className="hbgl-ig-more__error" role="alert">
              Gagal memuat postingan. Coba lagi ya.
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

/** Alt otomatis dari caption; caption panjang dipotong supaya tidak mendominasi. */
function altOf(caption: string): string {
  const text = caption.replace(/\s+/g, " ").trim();
  if (!text) return "Postingan Instagram Holiday Banyuwangi";
  return text.length > 120 ? `${text.slice(0, 117)}…` : text;
}
