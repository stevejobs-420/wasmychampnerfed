import { politeFetch } from "./fetch.js";
import type { ListingArticle } from "./types.js";

const LISTING_URL =
  "https://www.leagueoflegends.com/en-us/news/tags/patch-notes/";
const BASE = "https://www.leagueoflegends.com";

/**
 * The listing page embeds ALL patch-note articles in its __NEXT_DATA__ blob
 * (the "SHOW MORE" button is purely client-side, pager url is "#").
 * Verified 2026-06: 167 articles back to patch 9.1 (Jan 2019) in one fetch.
 */
export async function fetchListing(): Promise<ListingArticle[]> {
  const html = await politeFetch(LISTING_URL);
  const m = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s,
  );
  if (!m) throw new Error("listing: __NEXT_DATA__ not found — page layout changed?");
  const data = JSON.parse(m[1]);
  const blades: any[] = data?.props?.pageProps?.page?.blades ?? [];
  const grid = blades.find((b) => Array.isArray(b?.items));
  if (!grid) throw new Error("listing: no article grid blade found");

  const articles: ListingArticle[] = [];
  for (const item of grid.items) {
    const url: string | undefined = item?.action?.payload?.url;
    if (!url) continue;
    articles.push({
      title: item.title ?? "",
      // leaf pages require the trailing slash (no-slash 404s without redirect)
      url: new URL(url.endsWith("/") ? url : url + "/", BASE).href,
      publishedAt: item.publishedAt ?? item?.analytics?.publishDate ?? "",
    });
  }
  // newest first
  articles.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return articles;
}

/** "League of Legends Patch 26.12 Notes" / "patch-9-1-notes" → "26.12" / "9.1" */
export function patchVersion(article: ListingArticle): string | null {
  const fromTitle = article.title.match(/patch\s+(\d+)\.(\d+)/i);
  if (fromTitle) return `${fromTitle[1]}.${fromTitle[2]}`;
  const fromSlug = article.url.match(/patch-(\d+)-(\d+)/i);
  if (fromSlug) return `${fromSlug[1]}.${fromSlug[2]}`;
  return null;
}
