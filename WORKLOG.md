# wasmychampnerfed — work log

Summary of the build, from research handoff to deployed-ready repo.
Built 2026-06-10 → 2026-06-11 with Claude Code.

## The idea

A player enters any League of Legends champion name and gets the last time
that champion was buffed/nerfed/reworked, **with the actual change details**.
Aimed at lapsed players who don't follow patches. The groundwork was a
research handoff (`wasmychampnerfed-handoff.md`) that had already settled the
key questions: Riot's live API is useless for this, the official patch notes
are the data source, Data Dragon supplies the champion list, and the whole
thing is a batch problem (~26 patches/yr) — never scrape at request time.

## Decisions made at kickoff

| Decision | Choice |
|---|---|
| Stack | Node + TypeScript (one language for scraper, types, site) |
| Hosting | Static site + precomputed JSON — no servers |
| Scope | Full MVP: complete historical backfill + polished lookup site |
| UI | Plain CSS, no framework, no component library |

## Phase 1 — Recon (verify the handoff against reality)

Findings that shaped the build:

- **No pagination crawler needed.** The listing page at
  `/news/tags/patch-notes/` embeds **all** patch articles (167, back to patch
  9.1 / Jan 2019) in its `__NEXT_DATA__` blob. The "SHOW MORE" button is
  purely client-side. One fetch yields every slug + publish date.
- **Champion identification is easier than planned.** Each champion block's
  portrait URL embeds the Data Dragon key
  (`img/champion/MonkeyKing.png`) — a reliable machine ID. Name matching
  (plus a small alias map) is only the fallback.
- **Leaf URLs require a trailing slash** (404 without it).
- **Two markup generations exist**: modern `<ul><li>Stat: old ⇒ new</li>`
  and legacy (~2019) `div.attribute-change` with
  `attribute-before`/`attribute-after` spans. Both are supported.

## Phase 2 — Ingest pipeline (`src/`)

```
ddragon.ts    champion list + name/alias normalization (Wukong = MonkeyKing…)
listing.ts    parse __NEXT_DATA__ from the listing page → article slugs/dates
parser.ts     leaf page → blocks (entity, champion id, context, changes)
direction.ts  buff/nerf classifier (the interesting part, see below)
ingest.ts     orchestrator: crawl, cache, coverage check, emit dataset
fetch.ts      polite fetcher: bot UA, retries, 1.2 s delay between fetches
```

**The buff/nerf classifier.** Patch notes carry no machine-readable
buff/nerf label, and one champion block routinely mixes both. The only
reliable signal is the `old ⇒ new` value change per stat, classified by a
per-stat directionality table: damage/health/range/AD/AP up = buff,
cooldown/cost/cast-time up = nerf. Per-champion entries roll up to
buff / nerf / adjust (mixed). Edge cases fixed against real data:

- bare "Mana" (without "Cost") is a cost → lower is better
- "AS" abbreviation recognized; refund/regen/restore invert their base stat
- flat-vs-ranked comparisons (`60/55/50/45/40 ⇒ 60`) broadcast the scalar
  element-wise instead of comparing sums (sum said buff; reality was nerf)
- genuinely mixed lines (base damage down, AP ratio up) stay "adjust"

**The full backfill** ingested 164 patches (9.1 → 26.12) into
`site/data.json` (~2.8 MB): 172 champions, 2,663 champion-patch entries,
rollup distribution 1049 buff / 844 nerf / 770 adjust. Every champion has at
least one entry. One apparent anomaly — patch 11.23 matching 0 champions —
turned out correct (it's the all-items/jungle 2022 preseason patch). Pages
are cached in `.cache/pages/` so re-runs only fetch new patches.

## Phase 3 — The site (`site/`)

Static, framework-free: `index.html` + `style.css` + `app.js` + `data.json`.
Search with keyboard-navigable autocomplete, result card with direction
badge, designer-intent quote, per-ability change lines (old ⇒ **new**),
clickable history chips, `#wukong`-style deep links, and a "no changes since
at least patch X.Y" fallback.

**Design — "Hextech Reliquary."** Restyled with Anthropic's official
`frontend-design` skill (vendored at `.claude/skills/frontend-design/`),
modeled on the League client itself: void blue-black (`#010a13`), the
client's gold ramp (`#f0e6d2 → #c8aa6e → #463714`), arcane cyan reserved for
interaction, angular clipped-corner frames, faint hex lattice + grain
atmosphere, staggered entrance reveals (all CSS, disabled under
`prefers-reduced-motion`).

**Champion art** is hotlinked from Riot's Data Dragon CDN — dataset keys
*are* ddragon IDs, so portraits (autocomplete) and full splash art (card
banner, behind a dark scrim) are pure URL construction. Quirky IDs
(MonkeyKing, Fiddlesticks, Renata, K'Sante, Bel'Veth) verified; `onerror`
fallback drops the banner cleanly if art ever 404s.

**Typography — iterated on real feedback.** Final stack:

| Role | Font | Why |
|---|---|---|
| Display (title, names, badges) | Cinzel | engraved-caps cousin of Riot's Beaufort |
| Lore prose (quotes, tagline, search) | Alegreya | bookish but sturdy; EB Garamond proved too wispy on dark bg |
| Data (stat lines, patch numbers, chips) | Alegreya Sans | lining numerals; designed pair with Alegreya |

Readability lessons along the way: Garamond's old-style numerals are wrong
for stat strings; strikethrough over slash-separated numbers is unreadable
(now old = plain muted, new = bold white — Riot's own convention); a detour
through Atkinson Hyperlegible was reverted once the real culprit (the
Garamond quote) was identified.

Other UI fixes: suggestions dropdown lifted above the result card's stacking
context (`.search-wrap { z-index: 100 }`), title links home with a gold-glow
hover + center-out underline ornament.

## Phase 4 — Automation & shipping

- **GitHub Action** (`.github/workflows/ingest.yml`): twice-weekly cron +
  manual dispatch; restores the page cache, re-ingests, commits `data.json`
  only when changed.
- **Repo**: https://github.com/stevejobs-420/wasmychampnerfed
- **To finish deployment** (one-time GitHub settings):
  1. Pages: deploy from `main`, folder `/site` →
     `https://stevejobs-420.github.io/wasmychampnerfed/`
  2. Actions → Workflow permissions → "Read and write" (so the cron can
     commit the refreshed dataset)

## Ideas not yet done

- Custom domain (wasmychampnerfed.com) on Pages
- OG/social meta tags for link sharing
- Per-champion full history view beyond the 12 most recent chips
