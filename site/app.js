/* wasmychampnerfed — static lookup over data.json (no framework) */

const $search = document.getElementById("search");
const $suggestions = document.getElementById("suggestions");
const $result = document.getElementById("result");
const $meta = document.getElementById("meta");

let DATA = null;
let CHAMPS = []; // [{id, name, norm, entries}]
let activeIndex = -1;

const norm = (s) => s.toLowerCase().replace(/[^a-z]/g, "");
const esc = (s) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const DIRECTION_LABEL = { buff: "Buffed", nerf: "Nerfed", adjust: "Adjusted" };

/* Riot Data Dragon art — dataset keys are ddragon ids, so it's pure URL math */
const DD = "https://ddragon.leagueoflegends.com/cdn";
const portraitUrl = (id) => `${DD}/${DATA.ddragonVersion}/img/champion/${id}.png`;
const splashUrl = (id) => `${DD}/img/champion/splash/${id}_0.jpg`;

async function init() {
  const res = await fetch("data.json");
  DATA = await res.json();
  CHAMPS = Object.entries(DATA.champions)
    .map(([id, c]) => ({ id, name: c.name, norm: norm(c.name), entries: c.entries }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const newest = DATA.patchesCovered[0];
  const oldest = DATA.patchesCovered[DATA.patchesCovered.length - 1];
  $meta.textContent = `Covers patches ${oldest.version} – ${newest.version} · updated ${DATA.generatedAt.slice(0, 10)}`;

  // deep link: #wukong
  const hash = decodeURIComponent(location.hash.slice(1));
  if (hash) {
    const c = findChampion(hash);
    if (c) {
      $search.value = c.name;
      render(c);
    }
  }
}

function findChampion(q) {
  const n = norm(q);
  if (!n) return null;
  return (
    CHAMPS.find((c) => c.norm === n || norm(c.id) === n) ??
    CHAMPS.find((c) => c.norm.startsWith(n)) ??
    CHAMPS.find((c) => c.norm.includes(n)) ??
    null
  );
}

function suggest(q) {
  const n = norm(q);
  if (!n) {
    $suggestions.hidden = true;
    return;
  }
  const matches = CHAMPS.filter((c) => c.norm.includes(n) || norm(c.id).includes(n)).slice(0, 8);
  if (!matches.length) {
    $suggestions.hidden = true;
    return;
  }
  $suggestions.innerHTML = matches
    .map((c, i) => {
      const last = c.entries[0];
      const lastTxt = last ? `${DIRECTION_LABEL[last.direction]} · ${last.patch}` : "untouched";
      const lastCls = last ? last.direction : "";
      return `<li data-id="${c.id}" class="${i === 0 ? "active" : ""}">
        <span class="face"><img src="${portraitUrl(c.id)}" alt="" loading="lazy" /></span>
        <span class="who">${esc(c.name)}</span>
        <span class="last ${lastCls}">${lastTxt}</span>
      </li>`;
    })
    .join("");
  activeIndex = 0;
  $suggestions.hidden = false;
}

function pick(id) {
  const c = CHAMPS.find((x) => x.id === id);
  if (!c) return;
  $search.value = c.name;
  $suggestions.hidden = true;
  history.replaceState(null, "", "#" + encodeURIComponent(c.norm));
  render(c);
}

function changeLine(ch) {
  if (ch.old != null && ch.new != null) {
    return `<li class="${ch.direction}"><strong>${esc(ch.stat)}</strong>: <span class="old">${esc(ch.old)}</span><span class="arrow">⇒</span><span class="new-val">${esc(ch.new)}</span></li>`;
  }
  return `<li class="${ch.direction}">${esc(ch.raw)}</li>`;
}

function entryBodyHtml(entry) {
  const byAbility = [];
  for (const ch of entry.changes) {
    const key = ch.ability ?? "";
    const bucket = byAbility.find((b) => b.ability === key);
    if (bucket) bucket.changes.push(ch);
    else byAbility.push({ ability: key, changes: [ch] });
  }
  const date = new Date(entry.date + "T00:00:00Z");
  return `
    <p class="when">Patch <a href="${esc(entry.url)}" target="_blank" rel="noopener">${esc(entry.patch)}</a> · ${entry.date} · ${timeAgo(date)}</p>
    ${entry.context ? `<blockquote class="context">${esc(entry.context)}</blockquote>` : ""}
    ${byAbility
      .map(
        (b) => `
      ${b.ability ? `<p class="ability">${esc(b.ability)}</p>` : ""}
      <ul class="changes">${b.changes.map(changeLine).join("")}</ul>`,
      )
      .join("")}
  `;
}

function render(c, selectedIdx = 0) {
  $result.hidden = false;

  const banner = `
    <div class="banner">
      <img class="splash" src="${splashUrl(c.id)}" alt="" onerror="this.closest('.banner').remove()" />
      <div class="name-plate">
        <h2>${esc(c.name)}</h2>
        ${c.entries.length ? `<span class="badge ${c.entries[selectedIdx]?.direction ?? c.entries[0].direction}">${DIRECTION_LABEL[c.entries[selectedIdx]?.direction ?? c.entries[0].direction]}</span>` : ""}
      </div>
    </div>`;

  if (!c.entries.length) {
    const oldest = DATA.patchesCovered[DATA.patchesCovered.length - 1];
    $result.innerHTML = `<div class="card-frame"><div class="card">
      ${banner}
      <p class="not-found">No balance changes found since at least patch ${esc(oldest.version)} (${esc(oldest.date)}). Riot has left them alone.</p>
    </div></div>`;
    return;
  }

  const entry = c.entries[selectedIdx] ?? c.entries[0];
  const historyChips = c.entries
    .slice(0, 12)
    .map(
      (e, i) =>
        `<span class="chip ${e.direction} ${i === selectedIdx ? "selected" : ""}" data-idx="${i}" title="${DIRECTION_LABEL[e.direction]} — ${e.date}">${esc(e.patch)}</span>`,
    )
    .join("");

  $result.innerHTML = `<div class="card-frame"><div class="card">
    ${banner}
    <div class="card-body">
      ${entryBodyHtml(entry)}
      <div class="history-note">
        <span class="history-label">Chronicle of changes</span>
        ${historyChips}${c.entries.length > 12 ? ` <span class="more-note">+${c.entries.length - 12} older</span>` : ""}
      </div>
    </div>
  </div></div>`;

  $result.querySelectorAll(".chip[data-idx]").forEach((el) =>
    el.addEventListener("click", () => render(c, Number(el.dataset.idx))),
  );
}

function timeAgo(date) {
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days < 1) return "today";
  if (days < 31) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30.4);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return `${years} year${years === 1 ? "" : "s"}${rem ? ` ${rem} mo` : ""} ago`;
}

/* events */
$search.addEventListener("input", () => suggest($search.value));

$search.addEventListener("keydown", (e) => {
  const items = [...$suggestions.querySelectorAll("li")];
  if (e.key === "Enter") {
    e.preventDefault();
    if (!$suggestions.hidden && items[activeIndex]) {
      pick(items[activeIndex].dataset.id);
    } else {
      const c = findChampion($search.value);
      if (c) pick(c.id);
    }
  } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    if ($suggestions.hidden || !items.length) return;
    e.preventDefault();
    activeIndex = (activeIndex + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items.forEach((el, i) => el.classList.toggle("active", i === activeIndex));
    items[activeIndex].scrollIntoView({ block: "nearest" });
  } else if (e.key === "Escape") {
    $suggestions.hidden = true;
  }
});

$suggestions.addEventListener("mousedown", (e) => {
  const li = e.target.closest("li[data-id]");
  if (li) pick(li.dataset.id);
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".search-wrap")) $suggestions.hidden = true;
});

init().catch((err) => {
  $result.hidden = false;
  $result.innerHTML = `<div class="card-frame"><div class="card"><p class="not-found">Failed to load data: ${esc(String(err))}</p></div></div>`;
});
