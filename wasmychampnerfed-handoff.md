# wasmychampnerfed.com — research handoff

Side project idea: a player enters any League of Legends champion name and the
site returns the last time that champ was buffed/nerfed/reworked, **with the
actual change details**. Aimed at lapsed players who don't follow patches.

## TL;DR decisions

- **Riot Games API → not useful.** It's live game data (matches/summoners/ranked).
  No patch-over-patch balance change data. Drop it.
- **Data source = scrape the official patch notes** at leagueoflegends.com.
  Per-patch leaf pages are clean and consistently structured.
- **Data Dragon** is still needed as a *companion* — for the canonical champion
  list + name/alias map (e.g. Wukong = "MonkeyKing"), and optionally for
  stat-level diffing later.
- This is a **batch problem, not live.** Patches drop ~every 2 weeks (~26/yr).
  Ingest once per patch (cron / GitHub Action) → store small dataset
  (single JSON or SQLite, ~170 champs) → site serves precomputed lookups.
  No scraping at request time.

## Two-level page structure

1. **Listing (index)**: https://www.leagueoflegends.com/en-us/news/tags/patch-notes/
   - Paginated behind a "SHOW MORE" button (likely a Contentstack/CMS JSON API).
   - Only gives article slugs + dates. NOT the change data.
   - **Don't construct patch URLs** — slugs are inconsistent over time
     (`patch-25-11-notes` vs `league-of-legends-patch-26-11-notes`).
     Crawl the listing → collect real slugs → fetch each leaf.
2. **Leaf patch page** (the data we care about), e.g.
   https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-11-notes/
   - Server-rendered, clean HTML. ~282KB. Has a `__NEXT_DATA__` JSON blob
     (Next.js props) that almost certainly just embeds the same HTML as a
     rich-text string → **parsing rendered HTML directly is the simplest,
     most robust path** (no rotating CMS tokens).

## Confirmed leaf-page markup (verified against patch 26.11)

```html
<div class="patch-change-block white-stone accent-before">
  <blockquote class="blockquote context">      <!-- intent, PROSE ONLY -->
    <p>…a set of buffs and nerfs designed to…</p>
  </blockquote>
  <h3 class="change-title" id="patch-Summon-Aery">  <!-- entity name + portrait -->
    <a …>Summon Aery</a>
  </h3>
  <h4 class="change-detail-title ability-title">…</h4>   <!-- ability (Q/W/E/R) -->
  <ul>
    <li><strong>Damage Per Tick</strong>: 3 / 9 / 12 ⇒ <strong>4 / 12 / 16</strong></li>
    <li><strong>Summoned Voidmite HP</strong>: 60% ⇒ <strong>100%</strong></li>
  </ul>
</div>
```

Stable selectors: `.patch-change-block`, `.change-title` (entity),
`.change-detail-title.ability-title` (ability), `<li><strong>Stat</strong>: old ⇒ new</li>`.

## Buff vs nerf — the key finding (hypothesis disproven)

- There is **NO** buff/nerf category attribute, and changes are **NOT** split
  into separate buff/nerf sections. A single champion block routinely mixes
  buffs AND nerfs ("a set of buffs and nerfs… holistic pass").
- "buff"/"nerf" words appear only in the prose `<blockquote class="context">`.
- => The only machine-reliable signal is the **`⇒` value change** per stat.
  Classify with a small **per-stat directionality lookup**:
  - higher-is-better: damage, health, AD, AP, range, attack speed, …
  - lower-is-better: cooldown, mana/energy cost, cast time, …
  - keyed on the stat name (handles the damage-vs-cooldown problem).
- Per-CHANGE → buff/nerf via the map. Per-CHAMPION overall → often genuinely
  "Adjusted"; don't force a binary.

## Parsing gotchas (from real data)

1. **`patch-change-block` ≠ champion.** Blocks also cover items, runes
   (e.g. Summon Aery), jungle monsters (Grubs), systems. Filter to champions by
   matching `change-title` text against the Data Dragon champion list.
2. **Compound values:** `"3 / 9 / 12 || 1.5 / 4.5 / 6 ⇒ 4 / 12 / 16 || 2 / 6 / 8"`.
   Splitting old/new on `⇒` is trivial; comparing magnitude for direction means
   element-wise / summed comparison. Don't assume scalars.

## "How far back to crawl?" — long-tail coverage

- Walk backwards through patches, maintain a **coverage set** seeded from the
  DDragon champ list; stop when every champion has ≥1 entry.
- Realistically ~18–24 months (≈40–50 patches) to catch the last ignored champ.
- Add a **hard floor** (e.g. stop after N patches / 3 years); for never-touched
  champs show "no changes since at least patch X.Y".
- Easiest MVP: ingest **going forward** from today; do historical backfill as a
  separate one-time job.

## Proposed data model

```
Patch { version, date, blocks: [
  Block {
    entity, isChampion, context,
    changes: [ { ability, stat, old, new, direction: buff|nerf|adjust } ]
  }
] }
```

## Prior art

- CommunityDragon/LeaguePatchNotes (GitHub) — parses LoL patch notes to JSON,
  but **archived Sep 2020**, only patches ~8.13–8.22. Useless as a live source;
  fine as a parsing reference.

## Open / next steps

- [ ] (optional) Inspect `__NEXT_DATA__` to confirm it's just embedded HTML.
- [ ] Build the listing crawler (find the SHOW MORE API or paginate the HTML).
- [ ] Write the leaf-page parser → emit the data model above.
- [ ] Build the stat-name directionality lookup table.
- [ ] Pick stack (deferred — Node/TS vs Python TBD).
- [ ] Champion name normalization / alias map from Data Dragon.
- [ ] Decide hosting: static JSON vs tiny API; cron/GitHub Action for ingest.

## Notes

- Be a polite scraper: cache aggressively (only ~26 ingests/yr), identify the
  bot, respect robots.txt. Low volume, low risk.
- Renewal cost reminder: `.gg` domain ~$250/yr was the original trigger; project
  name uses `.com` instead.
