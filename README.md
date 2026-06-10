# wasmychampnerfed

Type a League of Legends champion, see the last time they were buffed, nerfed,
or adjusted — with the actual patch note details. Aimed at lapsed players who
don't follow patches.

## How it works

This is a **batch pipeline + static site** — no servers, no request-time scraping.

```
official patch notes ──▶ src/ingest.ts ──▶ site/data.json ──▶ static site
   (leagueoflegends.com)    (~26 runs/yr)                       (any static host)
```

1. **Listing** — `/news/tags/patch-notes/` embeds *all* patch articles
   (back to 9.1, Jan 2019) in its `__NEXT_DATA__` blob; one fetch yields every
   slug + date. Slugs are never constructed by hand (they're inconsistent
   across years).
2. **Leaf pages** — each patch page is parsed via stable selectors
   (`.patch-change-block`, `.change-title`, `.change-detail-title`). Two markup
   generations are supported: modern `<ul><li>Stat: old ⇒ new` and legacy
   (~2019) `div.attribute-change` spans.
3. **Champion detection** — blocks are matched to champions primarily via the
   Data Dragon key embedded in the portrait URL (`img/champion/MonkeyKing.png`),
   with name matching (plus alias map) as fallback. Item/rune/system blocks
   fall out naturally.
4. **Buff vs nerf** — the notes carry no machine-readable buff/nerf label, and
   a single champion block routinely mixes both. Each `old ⇒ new` stat line is
   classified with a per-stat directionality table (`src/direction.ts`):
   damage/health/range up = buff, cooldown/cost up = nerf, etc. A champion's
   patch entry rolls up to `buff` / `nerf` / `adjust` (mixed).
5. Pages are cached in `.cache/pages/` (published notes never change), so
   re-runs only fetch new patches.

## Usage

```sh
npm install
npm run ingest        # newest → oldest until every champion is covered
npm run ingest:full   # everything in the listing (~167 patches, ~7 min cold)
npm run serve         # serve site/ locally
```

The GitHub Action (`.github/workflows/ingest.yml`) re-ingests twice a week and
commits `site/data.json` when something changed.

## Notes

- Be polite: the ingest identifies itself, waits 1.2 s between fetches, and
  caches aggressively. Volume is ~26 new pages per year.
- Champions never touched within the crawl window render as
  "no changes since at least patch X.Y".
