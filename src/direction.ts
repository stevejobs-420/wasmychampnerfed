import type { Direction } from "./types.js";

/**
 * Patch notes never label buffs/nerfs — the only machine-reliable signal is
 * the "old ⇒ new" value change, classified per-stat by whether higher is
 * better for the champion. Rules are ordered: more specific patterns first.
 */
type Rule = { pattern: RegExp; higherIsBetter: boolean };

const RULES: Rule[] = [
  // gains that contain otherwise-negative words: must match before cost/mana rules
  { pattern: /refund|regen|restore|refresh/i, higherIsBetter: true },
  // costs & time-to-act: lower = better
  { pattern: /cooldown|recharge\s*time|recharge\s*rate/i, higherIsBetter: false },
  { pattern: /cost|\bmana\b|\benergy\b/i, higherIsBetter: false },
  { pattern: /cast\s*time|channel\s*(time|duration)|wind\s*up|windup|delay|lock\s*out|lockout/i, higherIsBetter: false },
  // harm to self: lower = better
  { pattern: /damage\s*(taken|received)|self\s*(damage|slow)/i, higherIsBetter: false },
  // everything that helps the champion: higher = better
  {
    pattern:
      /damage|health|\bhp\b|shield|heal|armor|resist(ance)?|\bmr\b|range|speed|duration|ratio|slow|stun|root|charm|fear|taunt|knock|haste|penetration|lethality|steal|vamp|crit|gold|\bxp\b|experience|charge|stack|bonus|\bad\b|\bap\b|\bas\b|attack|movement|move\s*speed|size|radius|width|targets|missiles|bolts|amount|value|cap|max/i,
    higherIsBetter: true,
  },
];

export function statHigherIsBetter(stat: string): boolean | null {
  for (const rule of RULES) {
    if (rule.pattern.test(stat)) return rule.higherIsBetter;
  }
  return null;
}

/** Extract numbers from a value string: "10/13.5/17%" → [10, 13.5, 17] */
export function extractNumbers(value: string): number[] {
  return (value.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
}

type Movement = "up" | "down" | "mixed" | "none";

/**
 * Compare old/new value strings. Element-wise when the counts match
 * (handles "3/9/12 ⇒ 4/12/16" and compound "a || b" values, since numbers
 * are extracted in order); falls back to comparing sums otherwise.
 */
export function compareValues(oldV: string, newV: string): Movement {
  const a = extractNumbers(oldV);
  const b = extractNumbers(newV);
  if (a.length === 0 || b.length === 0) return "none";
  let up = false;
  let down = false;
  if (a.length === b.length) {
    for (let i = 0; i < a.length; i++) {
      if (b[i] > a[i]) up = true;
      if (b[i] < a[i]) down = true;
    }
  } else if (a.length === 1 || b.length === 1) {
    // flat value vs per-rank array ("60/55/50/45/40 ⇒ 60"): broadcast the scalar
    const scalarIsOld = a.length === 1;
    const scalar = scalarIsOld ? a[0] : b[0];
    for (const n of scalarIsOld ? b : a) {
      const [o, nw] = scalarIsOld ? [scalar, n] : [n, scalar];
      if (nw > o) up = true;
      if (nw < o) down = true;
    }
  } else {
    const sa = a.reduce((s, n) => s + n, 0);
    const sb = b.reduce((s, n) => s + n, 0);
    up = sb > sa;
    down = sb < sa;
  }
  if (up && down) return "mixed";
  if (up) return "up";
  if (down) return "down";
  return "none";
}

export function classifyChange(stat: string, oldV: string | null, newV: string | null): Direction {
  if (oldV == null || newV == null) return "adjust";
  const movement = compareValues(oldV, newV);
  if (movement === "mixed" || movement === "none") return "adjust";
  const higherIsBetter = statHigherIsBetter(stat);
  if (higherIsBetter == null) return "adjust";
  const improved = movement === "up" ? higherIsBetter : !higherIsBetter;
  return improved ? "buff" : "nerf";
}

/** Per-champion rollup: pure buffs → buff, pure nerfs → nerf, anything mixed → adjust */
export function rollup(directions: Direction[]): Direction {
  const hasBuff = directions.includes("buff");
  const hasNerf = directions.includes("nerf");
  if (hasBuff && !hasNerf) return "buff";
  if (hasNerf && !hasBuff) return "nerf";
  return "adjust";
}
