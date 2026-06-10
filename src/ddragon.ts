import { politeFetch } from "./fetch.js";
import type { ChampionInfo } from "./types.js";

export interface DDragon {
  version: string;
  /** ddragon id → info */
  byId: Map<string, ChampionInfo>;
  /** normalized display name → ddragon id (includes id itself + aliases) */
  byName: Map<string, string>;
}

/** Lowercase, strip everything except letters (Kai'Sa → kaisa, Nunu & Willump → nunuwillump) */
export function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, "");
}

export async function loadDDragon(): Promise<DDragon> {
  const versions: string[] = JSON.parse(
    await politeFetch("https://ddragon.leagueoflegends.com/api/versions.json"),
  );
  const version = versions[0];
  const data = JSON.parse(
    await politeFetch(
      `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`,
    ),
  );

  const byId = new Map<string, ChampionInfo>();
  const byName = new Map<string, string>();
  for (const key of Object.keys(data.data)) {
    const c = data.data[key];
    byId.set(c.id, { id: c.id, name: c.name });
    byName.set(normalizeName(c.name), c.id);
    byName.set(normalizeName(c.id), c.id);
  }
  // Aliases seen in patch notes that don't match ddragon name/id directly
  const aliases: Record<string, string> = {
    nunu: "Nunu", // "Nunu & Willump" ddragon id is "Nunu"
    nunuandwillump: "Nunu",
    renataglasc: "Renata",
    renata: "Renata",
    drmundo: "DrMundo",
    wukong: "MonkeyKing",
  };
  for (const [alias, id] of Object.entries(aliases)) {
    if (byId.has(id)) byName.set(alias, id);
  }
  return { version, byId, byName };
}
