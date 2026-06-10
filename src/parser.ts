import * as cheerio from "cheerio";
import type { Block, Change } from "./types.js";
import { classifyChange, rollup } from "./direction.js";
import { normalizeName, type DDragon } from "./ddragon.js";

const ARROW = "⇒";

/**
 * Parse one stat line. Canonical shape:
 *   <li><strong>Stat</strong>: old ⇒ <strong>new</strong></li>
 * Lines without "⇒" (New Effect, Removed, prose) are kept raw as "adjust".
 */
function parseLine(text: string, ability: string | null): Change {
  const raw = text.replace(/\s+/g, " ").trim();
  const colon = raw.indexOf(":");
  const stat = colon > 0 ? raw.slice(0, colon).trim() : raw;
  if (raw.includes(ARROW) && colon > 0) {
    const [oldV, newV] = raw
      .slice(colon + 1)
      .split(ARROW)
      .map((s) => s.trim());
    if (oldV && newV) {
      return {
        ability,
        stat,
        old: oldV,
        new: newV,
        raw,
        direction: classifyChange(stat, oldV, newV),
      };
    }
  }
  return { ability, stat, old: null, new: null, raw, direction: "adjust" };
}

/** Resolve a change block to a ddragon champion id, or null for items/runes/systems. */
function resolveChampion($: cheerio.CheerioAPI, el: any, entity: string, dd: DDragon): string | null {
  // primary: champion portrait URL embeds the ddragon key
  const img = $(el).find("a.reference-link img").attr("src") ?? "";
  const m = img.match(/img\/champion\/([A-Za-z]+)\.png/);
  if (m && dd.byId.has(m[1])) return m[1];
  // fallback: match display name (handles older pages without portraits)
  return dd.byName.get(normalizeName(entity)) ?? null;
}

export function parsePatchPage(html: string, dd: DDragon): Block[] {
  const $ = cheerio.load(html);
  const blocks: Block[] = [];

  $(".patch-change-block").each((_, el) => {
    const entity = $(el).find("h3.change-title").first().text().trim();
    if (!entity) return;

    const context =
      $(el).find("blockquote.context").first().text().replace(/\s+/g, " ").trim() || null;

    const changes: Change[] = [];
    let ability: string | null = null;
    // walk in document order so each change attaches to the preceding heading.
    // Two formats: modern (2020+) <ul><li>Stat: old ⇒ new</li>, and legacy
    // (~2019) <div class="attribute-change"><span class="attribute">…
    $(el)
      .find("h4.change-detail-title, ul > li, div.attribute-change")
      .each((_, node) => {
        const $node = $(node);
        if (node.tagName === "h4") {
          ability = $node.text().replace(/\s+/g, " ").trim() || null;
        } else if ($node.hasClass("attribute-change")) {
          const clean = (s: string) => s.replace(/\s+/g, " ").trim();
          // "new"/"removed" label spans nest inside .attribute — drop them
          $node.find(".attribute .new, .attribute .removed").remove();
          const stat = clean($node.find(".attribute").first().text());
          const removedText = clean($node.find(".attribute-removed").first().text());
          const oldV = clean($node.find(".attribute-before").first().text()) || null;
          const newV = clean($node.find(".attribute-after").first().text()) || null;
          if (!stat) return;
          changes.push({
            ability,
            stat,
            old: oldV,
            new: newV ?? (removedText || null),
            raw: clean($node.text()),
            direction: oldV && newV ? classifyChange(stat, oldV, newV) : "adjust",
          });
        } else {
          const text = $node.text();
          if (text.trim()) changes.push(parseLine(text, ability));
        }
      });

    blocks.push({
      entity,
      championId: resolveChampion($, el, entity, dd),
      context,
      changes,
      direction: rollup(changes.map((c) => c.direction)),
    });
  });

  return blocks;
}
