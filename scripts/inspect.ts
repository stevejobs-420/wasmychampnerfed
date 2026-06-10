import { parsePatchPage } from "../src/parser.js";
import { loadDDragon } from "../src/ddragon.js";
import fs from "node:fs";
const dd = await loadDDragon();
const file = fs.readdirSync(".cache/pages").find((f) => f.includes("11_23"));
const blocks = parsePatchPage(fs.readFileSync(".cache/pages/" + file, "utf8"), dd);
console.log(file, "->", blocks.length, "blocks");
for (const b of blocks.slice(0, 12)) console.log(`  champ:${b.championId} entity:"${b.entity}" changes:${b.changes.length}`);
