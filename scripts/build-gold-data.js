/**
 * Import TradingView XAUUSD CSV exports into compact per-timeframe JSON.
 * Usage: node scripts/build-gold-data.js
 */
const fs = require("fs");
const path = require("path");

const DOWNLOADS = path.join(process.env.USERPROFILE || process.env.HOME || "", "Downloads");
const OUT_DIR = path.join(__dirname, "..", "public", "data", "gold");

const SOURCES = [
  { tf: "M5", file: "TVC_GOLD, 5_9da70.csv", minutes: 5 },
  { tf: "M15", file: "TVC_GOLD, 15_70893.csv", minutes: 15 },
  { tf: "M30", file: "TVC_GOLD, 30_2047c.csv", minutes: 30 },
  { tf: "H1", file: "TVC_GOLD, 60_e267b.csv", minutes: 60 },
  { tf: "H4", file: "TVC_GOLD, 240_3b218.csv", minutes: 240 },
  { tf: "D1", file: "TVC_GOLD, 1D_61c3a.csv", minutes: 1440 },
];

function parseCsv(filePath) {
  const text = fs.readFileSync(filePath, "utf8").trim();
  return text
    .split("\n")
    .slice(1)
    .map((line) => {
      const [time, open, high, low, close] = line.split(",");
      if (!time) return null;
      return [Number(time), +open, +high, +low, +close];
    })
    .filter((b) => b && Number.isFinite(b[4]));
}

function writeTf(tf, bars, minutes) {
  const out = {
    tf,
    minutes,
    symbol: "XAUUSD",
    source: "TradingView TVC:GOLD",
    count: bars.length,
    from: bars[0]?.[0],
    to: bars.at(-1)?.[0],
    bars,
  };
  const file = path.join(OUT_DIR, `${tf.toLowerCase()}.json`);
  fs.writeFileSync(file, JSON.stringify(out));
  const kb = Math.round(fs.statSync(file).size / 1024);
  console.log(`  ${tf}: ${bars.length} bars → ${kb} KB`);
  return out;
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const manifest = { symbol: "XAUUSD", source: "TradingView TVC:GOLD", builtAt: new Date().toISOString(), timeframes: {} };

  for (const src of SOURCES) {
    const filePath = path.join(DOWNLOADS, src.file);
    if (!fs.existsSync(filePath)) {
      console.warn("Missing:", src.file);
      continue;
    }
    const bars = parseCsv(filePath);
    writeTf(src.tf, bars, src.minutes);
    manifest.timeframes[src.tf] = {
      file: `${src.tf.toLowerCase()}.json`,
      minutes: src.minutes,
      count: bars.length,
      from: bars[0]?.[0],
      to: bars.at(-1)?.[0],
    };
  }

  fs.writeFileSync(path.join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log("Wrote manifest.json");
}

main();
