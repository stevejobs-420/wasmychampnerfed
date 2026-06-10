import { parsePatchPage } from "../src/parser.js";
import { loadDDragon } from "../src/ddragon.js";
import fs from "node:fs";
const dd = await loadDDragon();
const blocks = parsePatchPage(fs.readFileSync(process.argv[2], "utf8"), dd);
for (const b of blocks) {
  console.log(`[${b.direction.toUpperCase().padEnd(6)}] ${b.entity} (champ: ${b.championId})`);
  for (const c of b.changes)
    console.log(`    ${c.direction.padEnd(6)} | ${c.ability ?? "-"} | ${c.stat}: ${c.old ?? ""} => ${c.new ?? c.raw.slice(0, 60)}`);
}
