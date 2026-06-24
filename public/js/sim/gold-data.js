/** Real XAUUSD OHLC from TradingView exports — all timeframes */

export const TIMEFRAMES = ["M1", "M5", "M15", "H1", "H4", "D1"];

const TF_NATIVE = {
  M5: "m5",
  M15: "m15",
  M30: "m30",
  H1: "h1",
  H4: "h4",
  D1: "d1",
};

/** Bars in one 24-hour window per timeframe (history before decision candle) */
const BARS_ONE_DAY = {
  M1: 1440,
  M5: 288,
  M15: 96,
  H1: 24,
  H4: 6,
  D1: 2,
};

/** Lookback shown on chart — at least 1 full day; higher TFs add readable context */
const LOOKBACK = {
  M1: BARS_ONE_DAY.M1,
  M5: BARS_ONE_DAY.M5,
  M15: BARS_ONE_DAY.M15,
  H1: Math.max(BARS_ONE_DAY.H1, 48),
  H4: Math.max(BARS_ONE_DAY.H4, 18),
  D1: Math.max(BARS_ONE_DAY.D1, 14),
};

export function lookbackFor(tf) {
  return LOOKBACK[tf] || BARS_ONE_DAY.M15;
}

export function contextLabel(tf) {
  const bars = lookbackFor(tf);
  if (tf === "D1") return `${bars} days of context`;
  if (tf === "H4") return `${((bars * 4) / 24).toFixed(1)}+ days · ${bars} candles`;
  if (tf === "H1") return `${(bars / 24).toFixed(1)}+ days · ${bars} candles`;
  const hours = tf === "M1" ? bars / 60 : tf === "M5" ? (bars * 5) / 60 : (bars * 15) / 60;
  return `${hours >= 24 ? "24h+" : hours + "h"} · ${bars} candles`;
}

function m15BarsNeeded(tf, lookback) {
  if (tf === "M1") return Math.ceil(lookback / 15) + 1;
  if (tf === "M5") return lookback * 3 + 3;
  return lookback + 2;
}

const cache = new Map();

function unpackBar(row) {
  return { t: row[0] * 1000, o: row[1], h: row[2], l: row[3], c: row[4] };
}

function unpackBars(rows) {
  return rows.map(unpackBar);
}

async function loadNative(tf) {
  const key = TF_NATIVE[tf];
  if (!key) return null;
  if (cache.has(key)) return cache.get(key);

  const res = await fetch(`/data/gold/${key}.json`);
  if (!res.ok) return null;
  const data = await res.json();
  const bars = unpackBars(data.bars || []);
  const packed = { bars, from: bars[0]?.t, to: bars.at(-1)?.t, minutes: data.minutes };
  cache.set(key, packed);
  return packed;
}

async function loadM15() {
  return loadNative("M15");
}

function findIndexAtOrBefore(bars, anchorTs) {
  let lo = 0;
  let hi = bars.length - 1;
  let best = bars.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (bars[mid].t <= anchorTs) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}

function sliceEndingAt(bars, anchorTs, count) {
  const idx = findIndexAtOrBefore(bars, anchorTs);
  return bars.slice(Math.max(0, idx - count + 1), idx + 1);
}

function aggregateBars(bars, factor) {
  if (factor <= 1) return bars.map((b) => ({ ...b }));
  const out = [];
  for (let i = 0; i < bars.length; i += factor) {
    const chunk = bars.slice(i, i + factor);
    if (!chunk.length) continue;
    out.push({
      t: chunk[0].t,
      o: chunk[0].o,
      h: Math.max(...chunk.map((b) => b.h)),
      l: Math.min(...chunk.map((b) => b.l)),
      c: chunk.at(-1).c,
    });
  }
  return out;
}

/** Expand one M15 bar into 15 × M1 bars (OHLC path from real 15m candle) */
function expandM15Bar(bar) {
  const { o, h, l, c, t } = bar;
  const out = [];
  const step = 60_000;
  for (let i = 0; i < 15; i++) {
    const frac0 = i / 15;
    const frac1 = (i + 1) / 15;
    const open = i === 0 ? o : out[i - 1].c;
    const close = +(o + (c - o) * frac1).toFixed(2);
    const midHigh = Math.max(open, close);
    const midLow = Math.min(open, close);
    const high = i === Math.floor(7.5) ? Math.max(h, midHigh) : midHigh;
    const low = i === Math.floor(11.5) ? Math.min(l, midLow) : midLow;
    out.push({ t: t + i * step, o: open, h: high, l: low, c: close });
  }
  return out;
}

function m15SliceToM1(m15Bars) {
  return m15Bars.flatMap(expandM15Bar);
}

function m15SliceToM5(m15Bars) {
  return aggregateBars(m15Bars, 3);
}

export async function loadBarsForTimeframe(tf, anchorTs) {
  const lookback = lookbackFor(tf);

  if (tf === "M1") {
    const m15 = await loadM15();
    if (!m15) return [];
    const slice = sliceEndingAt(m15.bars, anchorTs, m15BarsNeeded("M1", lookback));
    const m1 = m15SliceToM1(slice);
    return m1.slice(-lookback);
  }

  if (tf === "M5") {
    const native = await loadNative("M5");
    if (native && anchorTs >= native.from && anchorTs <= native.to) {
      const sliced = sliceEndingAt(native.bars, anchorTs, lookback);
      if (sliced.length >= BARS_ONE_DAY.M5) return sliced;
    }
    const m15 = await loadM15();
    if (!m15) return [];
    const slice = sliceEndingAt(m15.bars, anchorTs, m15BarsNeeded("M5", lookback));
    return m15SliceToM5(slice).slice(-lookback);
  }

  const native = await loadNative(tf);
  if (!native) return [];
  return sliceEndingAt(native.bars, anchorTs, lookback);
}

export function formatBarTime(ts, tf) {
  const d = new Date(ts);
  if (tf === "D1") {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
  }
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/New_York",
    hour12: true,
  });
}

export async function preloadGoldData() {
  await loadM15();
}
