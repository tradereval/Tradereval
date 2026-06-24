/**
 * Build session replay clips from TradingView XAUUSD CSV exports.
 * Usage: node scripts/build-replay-clips.js [path-to-csv]
 */
const fs = require("fs");
const path = require("path");

const DEFAULT_CSV = path.join(
  process.env.USERPROFILE || process.env.HOME || "",
  "Downloads",
  "TVC_GOLD, 15_70893.csv"
);
const OUT = path.join(__dirname, "..", "public", "data", "replay-clips.json");
const INDEX_OUT = path.join(__dirname, "..", "public", "data", "replay-index.json");

const CLIP_BARS = 48;
const PRE_SESSION = 32;
const POST_SESSION = CLIP_BARS - PRE_SESSION;

const SESSIONS = {
  ny_open: { hour: 13, minute: 30, label: "NY Open", altHour: 12, altMinute: 30 },
  london_open: { hour: 8, minute: 0, label: "London Open" },
  ny_overlap: { hour: 14, minute: 0, label: "London–NY Overlap" },
};

function parseCsv(filePath) {
  const text = fs.readFileSync(filePath, "utf8").trim();
  const lines = text.split("\n").slice(1);
  return lines
    .map((line) => {
      const [time, open, high, low, close] = line.split(",");
      if (!time) return null;
      return {
        t: Number(time) * 1000,
        o: +open,
        h: +high,
        l: +low,
        c: +close,
      };
    })
    .filter((b) => b && Number.isFinite(b.c));
}

function matchesSession(d, cfg) {
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  if (h === cfg.hour && m === cfg.minute) return true;
  if (cfg.altHour != null && h === cfg.altHour && m === cfg.altMinute) return true;
  return false;
}

function summarizeClip(clip) {
  const bars = clip.bars;
  const marker = clip.markerBar ?? 32;
  const pre = bars.slice(0, marker);
  const post = bars.slice(marker);
  const sessionMove = post.length ? post.at(-1).c - post[0].o : 0;
  const dayMove = bars.at(-1).c - bars[0].o;
  const high = Math.max(...bars.map((b) => b.h));
  const low = Math.min(...bars.map((b) => b.l));
  const range = high - low;

  let character = "choppy_range";
  if (sessionMove > 6) character = "bullish_breakout";
  else if (sessionMove > 2.5) character = "bullish_trend";
  else if (sessionMove < -6) character = "bearish_breakdown";
  else if (sessionMove < -2.5) character = "bearish_trend";
  else if (Math.abs(sessionMove) < 1.5) character = "tight_chop";

  const preMove = pre.length ? pre.at(-1).c - pre[0].o : 0;
  if (preMove > 3 && sessionMove < -2) character = "pullback_after_rally";
  if (preMove < -3 && sessionMove > 2) character = "recovery_bounce";

  return {
    id: clip.id,
    date: clip.date,
    session: clip.session,
    sessionLabel: clip.sessionLabel,
    character,
    sessionMove: +sessionMove.toFixed(1),
    dayMove: +dayMove.toFixed(1),
    range: +range.toFixed(1),
    priceLevel: Math.round(bars[marker]?.o || bars[0].o),
  };
}

function extractClips(bars, sessionKey, cfg) {
  const clips = [];
  const seenDates = new Set();

  for (let i = PRE_SESSION; i < bars.length - POST_SESSION; i++) {
    const d = new Date(bars[i].t);
    if (!matchesSession(d, cfg)) continue;

    const dateKey = d.toISOString().slice(0, 10);
    if (seenDates.has(dateKey)) continue;
    seenDates.add(dateKey);

    const slice = bars.slice(i - PRE_SESSION, i - PRE_SESSION + CLIP_BARS);
    if (slice.length < CLIP_BARS) continue;

    clips.push({
      id: `${sessionKey}-${dateKey}`,
      date: dateKey,
      session: sessionKey,
      sessionLabel: cfg.label,
      markerBar: PRE_SESSION,
      bars: slice.map((b) => ({
        t: b.t,
        o: +b.o.toFixed(2),
        h: +b.h.toFixed(2),
        l: +b.l.toFixed(2),
        c: +b.c.toFixed(2),
      })),
    });
  }

  return clips;
}

function main() {
  const csvPath = process.argv[2] || DEFAULT_CSV;
  if (!fs.existsSync(csvPath)) {
    console.error("CSV not found:", csvPath);
    process.exit(1);
  }

  const bars = parseCsv(csvPath);
  const sessions = {};
  const indexSessions = {};

  for (const [key, cfg] of Object.entries(SESSIONS)) {
    sessions[key] = extractClips(bars, key, cfg);
    indexSessions[key] = sessions[key].map(summarizeClip);
    console.log(`${cfg.label}: ${sessions[key].length} clips`);
  }

  const payload = {
    symbol: "XAUUSD",
    timeframe: "M15",
    source: path.basename(csvPath),
    builtAt: new Date().toISOString(),
    clipBars: CLIP_BARS,
    sessions,
  };

  const indexPayload = {
    symbol: "XAUUSD",
    builtAt: new Date().toISOString(),
    sessions: indexSessions,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload));
  fs.writeFileSync(INDEX_OUT, JSON.stringify(indexPayload));

  const kb = Math.round(fs.statSync(OUT).size / 1024);
  const idxKb = Math.round(fs.statSync(INDEX_OUT).size / 1024);
  console.log(`Wrote ${OUT} (${kb} KB)`);
  console.log(`Wrote ${INDEX_OUT} (${idxKb} KB)`);
}

main();
