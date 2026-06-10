import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { politeFetch, sleep } from "./fetch.js";
import { loadDDragon } from "./ddragon.js";
import { fetchListing, patchVersion } from "./listing.js";
import { parsePatchPage } from "./parser.js";
import type { Dataset, ChampionEntry, ListingArticle } from "./types.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CACHE_DIR = path.join(ROOT, ".cache", "pages");
const OUT_FILE = path.join(ROOT, "site", "data.json");

const FULL = process.argv.includes("--full");
const FETCH_DELAY_MS = 1200;

/** Cache leaf pages on disk — published patch notes never change, so re-runs are free. */
async function fetchPage(article: ListingArticle): Promise<string> {
  const slug = new URL(article.url).pathname.replace(/\W+/g, "_");
  const cached = path.join(CACHE_DIR, slug + ".html");
  if (fs.existsSync(cached)) return fs.readFileSync(cached, "utf8");
  const html = await politeFetch(article.url);
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(cached, html);
  await sleep(FETCH_DELAY_MS);
  return html;
}

async function main() {
  const dd = await loadDDragon();
  console.log(`ddragon ${dd.version}: ${dd.byId.size} champions`);

  const articles = (await fetchListing()).filter((a) => patchVersion(a));
  console.log(`listing: ${articles.length} patch articles (${patchVersion(articles.at(-1)!)} → ${patchVersion(articles[0])})`);

  // Walk newest → oldest. Default mode stops once every champion has ≥1 entry
  // (plus a small buffer so near-full coverage doesn't crawl 7 years for one
  // never-touched champ); --full ingests everything in the listing.
  const uncovered = new Set(dd.byId.keys());
  const champions: Dataset["champions"] = {};
  const patchesCovered: Dataset["patchesCovered"] = [];
  const HARD_FLOOR = FULL ? articles.length : 120;

  for (const [i, article] of articles.entries()) {
    if (i >= HARD_FLOOR) break;
    if (!FULL && uncovered.size === 0) break;

    const version = patchVersion(article)!;
    let html: string;
    try {
      html = await fetchPage(article);
    } catch (err) {
      console.warn(`  skip ${version}: ${err}`);
      continue;
    }
    const blocks = parsePatchPage(html, dd);
    const champBlocks = blocks.filter((b) => b.championId);

    for (const block of champBlocks) {
      const id = block.championId!;
      uncovered.delete(id);
      champions[id] ??= { name: dd.byId.get(id)!.name, entries: [] };
      const entry: ChampionEntry = {
        patch: version,
        date: article.publishedAt.slice(0, 10),
        url: article.url,
        direction: block.direction,
        context: block.context,
        changes: block.changes,
      };
      champions[id].entries.push(entry);
    }

    patchesCovered.push({
      version,
      date: article.publishedAt.slice(0, 10),
      url: article.url,
    });
    console.log(
      `${version.padEnd(6)} ${champBlocks.length}/${blocks.length} champion blocks, ${uncovered.size} champs still uncovered`,
    );
  }

  if (uncovered.size > 0) {
    console.log(`\nNo entry found for ${uncovered.size} champions (will show "no changes since at least patch ${patchesCovered.at(-1)?.version}"):`);
    console.log("  " + [...uncovered].sort().join(", "));
  }

  const dataset: Dataset = {
    generatedAt: new Date().toISOString(),
    ddragonVersion: dd.version,
    patchesCovered,
    champions,
  };
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(dataset));
  const kb = Math.round(fs.statSync(OUT_FILE).size / 1024);
  console.log(`\nwrote ${OUT_FILE} (${kb} KB, ${Object.keys(champions).length} champions, ${patchesCovered.length} patches)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
