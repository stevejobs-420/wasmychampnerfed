export type Direction = "buff" | "nerf" | "adjust";

/** One stat line, e.g. "Sweet Spot Bonus Damage: 70 ⇒ 75" */
export interface Change {
  /** Ability or section heading, e.g. "Q - The Darkin Blade", "Base Stats" */
  ability: string | null;
  /** Stat name, e.g. "Sweet Spot Bonus Damage" */
  stat: string;
  old: string | null;
  new: string | null;
  /** Raw line text for changes that don't fit old ⇒ new (New Effect, Removed, …) */
  raw: string;
  direction: Direction;
}

/** One .patch-change-block (champion, item, rune, system…) */
export interface Block {
  entity: string;
  /** Data Dragon champion id (e.g. "MonkeyKing") when the block is a champion */
  championId: string | null;
  /** Designer intent prose from the blockquote */
  context: string | null;
  changes: Change[];
  /** Rollup over changes: all buff → buff, all nerf → nerf, else adjust */
  direction: Direction;
}

export interface Patch {
  /** e.g. "26.12" */
  version: string;
  title: string;
  url: string;
  publishedAt: string;
  blocks: Block[];
}

export interface ListingArticle {
  title: string;
  url: string;
  publishedAt: string;
}

export interface ChampionInfo {
  /** Data Dragon id, e.g. "MonkeyKing" */
  id: string;
  /** Display name, e.g. "Wukong" */
  name: string;
}

/** Per-champion entry in the published dataset */
export interface ChampionEntry {
  patch: string;
  date: string;
  url: string;
  direction: Direction;
  context: string | null;
  changes: Change[];
}

export interface Dataset {
  generatedAt: string;
  ddragonVersion: string;
  patchesCovered: { version: string; date: string; url: string }[];
  champions: Record<
    string,
    { name: string; entries: ChampionEntry[] }
  >;
}
