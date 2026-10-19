import { NextResponse } from "next/server";

import { getInstagramFeed, IG_BATCH } from "@/lib/instagram-feed";

export const dynamic = "force-dynamic";

/**
 * Postingan Instagram berikutnya untuk tombol "Muat Lebih Banyak".
 *
 * Halaman beranda merender batch pertama di server; endpoint ini hanya
 * menambah satu batch per klik supaya pengunjung tidak menarik seluruh feed
 * sekaligus. `no-store` karena isi feed bisa berubah kapan saja lewat
 * sinkronisasi di latar belakang.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawOffset = Number.parseInt(searchParams.get("offset") ?? "", 10);
  const offset = Number.isFinite(rawOffset) && rawOffset > 0 ? rawOffset : 0;

  const { posts, total } = await getInstagramFeed(offset, IG_BATCH);

  return NextResponse.json(
    { posts, hasMore: offset + posts.length < total },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
