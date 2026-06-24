const fs = require("fs");
const path = require("path");

const INDEX_PATH = path.join(__dirname, "..", "public", "data", "replay-index.json");
const CLIPS_PATH = path.join(__dirname, "..", "public", "data", "replay-clips.json");

let indexCache = null;
let clipIdCache = null;

function loadIndex() {
  if (indexCache) return indexCache;
  if (!fs.existsSync(INDEX_PATH)) return { sessions: {} };
  indexCache = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));
  return indexCache;
}

function loadClipIds() {
  if (clipIdCache) return clipIdCache;
  if (!fs.existsSync(CLIPS_PATH)) return new Set();
  const data = JSON.parse(fs.readFileSync(CLIPS_PATH, "utf8"));
  const ids = new Set();
  for (const clips of Object.values(data.sessions || {})) {
    for (const c of clips) ids.add(c.id);
  }
  clipIdCache = ids;
  return ids;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, seed) {
  const rand = mulberry32(seed);
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Flat pool of clip summaries, shuffled, excluding already-used ids */
function shuffledPool(usedIds = [], seed = Date.now()) {
  const index = loadIndex();
  const pool = [];
  for (const clips of Object.values(index.sessions || {})) {
    for (const c of clips) {
      if (!usedIds.includes(c.id)) pool.push(c);
    }
  }
  return shuffle(pool, seed);
}

/** Build shuffled menu for OpenAI — extra options so AI can curate variety */
function buildReplayMenu({ usedIds = [], windowsNeeded = 2, seed = Date.now() }) {
  const pool = shuffledPool(usedIds, seed);
  const menuSize = Math.min(pool.length, Math.max(windowsNeeded * 4, 12));
  return pool.slice(0, menuSize);
}

function formatMenuForPrompt(menu) {
  return menu
    .map(
      (c) =>
        `• ${c.id} | ${c.sessionLabel} | ${c.date} | ${c.character} | session ${c.sessionMove >= 0 ? "+" : ""}${c.sessionMove} pts | range ${c.range} pts | ~${c.priceLevel}`
    )
    .join("\n");
}

function isValidClipId(id) {
  return loadClipIds().has(id);
}

/** Resolve AI picks; fill gaps from shuffled reserve */
function resolveReplayPicks(windows, menu, usedIds = [], seed = Date.now()) {
  const reserve = shuffledPool([...usedIds, ...menu.map((c) => c.id)], seed + 1);
  const picked = new Set(usedIds);
  const bySession = {};
  for (const c of menu) {
    if (!bySession[c.session]) bySession[c.session] = [];
    bySession[c.session].push(c);
  }
  for (const c of reserve) {
    if (!bySession[c.session]) bySession[c.session] = [];
    bySession[c.session].push(c);
  }

  return windows.map((w, wi) => {
    let id = w.replayClipId;
    const session = w.marketSession || "ny_open";

    if (!id || !isValidClipId(id) || picked.has(id)) {
      const candidate =
        bySession[session]?.find((c) => !picked.has(c.id)) ||
        reserve.find((c) => !picked.has(c.id));
      id = candidate?.id;
    }

    if (id) picked.add(id);
    const meta = menu.find((c) => c.id === id) || reserve.find((c) => c.id === id);
    return { ...w, replayClipId: id || null, replayMeta: meta || null };
  });
}

module.exports = {
  buildReplayMenu,
  formatMenuForPrompt,
  resolveReplayPicks,
  shuffledPool,
  isValidClipId,
};
