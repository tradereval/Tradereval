/** Each raw bar ≈ 15 minutes unless aggregated for higher TFs */

const SITUATION_LABELS = {
  trend_pullback: "Pullback in trend",
  fomo_chase: "Extended move — FOMO risk",
  chop_no_edge: "Chop — no clear edge",
  range_fade: "Range boundary fade",
  fake_breakout: "False breakout trap",
  post_loss_pressure: "Post-loss pressure",
  recovery_setup: "Recovery setup",
  session_end: "Session end — manage risk",
};

const TF_MINUTES = { M15: 15, H1: 60, H4: 240, D1: 1440 };

export function situationLabel(key) {
  return SITUATION_LABELS[key] || key?.replace(/_/g, " ") || "Decision window";
}

export function addTimestamps(bars, minutesPerBar = 15, sessionStartHour = 8) {
  const base = new Date();
  base.setHours(sessionStartHour, 0, 0, 0);
  return bars.map((b, i) => ({
    ...b,
    t: b.t ?? base.getTime() + i * minutesPerBar * 60_000,
  }));
}

/** Build leading context so AI windows feel like a real chart, not 12 random candles */
export function enrichBarsWithHistory(bars, targetCount = 48) {
  if (!bars?.length) return [];
  const out = [];
  let price = bars[0].o;
  const need = Math.max(0, targetCount - bars.length);
  let seed = bars.reduce((s, b) => s + b.c, 0);

  const rand = () => {
    seed = (seed * 16807 + 7) % 2147483647;
    return (seed % 1000) / 1000;
  };

  const drift = (bars[bars.length - 1].c - bars[0].o) / Math.max(bars.length, 1);

  for (let i = 0; i < need; i++) {
    const o = price;
    const bias = drift * 0.15 + (rand() - 0.5) * 1.2;
    const c = +(o + bias).toFixed(2);
    const h = +(Math.max(o, c) + rand() * 1.4).toFixed(2);
    const l = +(Math.min(o, c) - rand() * 1.2).toFixed(2);
    out.push({ o, h, l, c });
    price = c;
  }

  const stitched = [...out, ...bars.map((b) => ({ ...b }))];
  return addTimestamps(stitched);
}

export function aggregateBars(bars, tf) {
  const mins = TF_MINUTES[tf] || 15;
  const factor = Math.max(1, Math.round(mins / 15));
  if (factor <= 1) return bars.map((b) => ({ ...b }));

  const out = [];
  for (let i = 0; i < bars.length; i += factor) {
    const chunk = bars.slice(i, i + factor);
    if (!chunk.length) continue;
    out.push({
      o: chunk[0].o,
      h: Math.max(...chunk.map((b) => b.h)),
      l: Math.min(...chunk.map((b) => b.l)),
      c: chunk.at(-1).c,
      t: chunk[0].t,
      v: chunk.length,
    });
  }
  return out;
}

export function emaValues(bars, period = 20) {
  if (!bars.length) return [];
  const k = 2 / (period + 1);
  const vals = [];
  let prev = bars[0].c;
  for (let i = 0; i < bars.length; i++) {
    prev = i === 0 ? bars[i].c : bars[i].c * k + prev * (1 - k);
    vals.push(prev);
  }
  return vals;
}

export function computeLevels(bars, endIndex) {
  const slice = bars.slice(Math.max(0, endIndex - 30), endIndex + 1);
  if (slice.length < 4) return {};
  const highs = slice.map((b) => b.h);
  const lows = slice.map((b) => b.l);
  const swingHigh = Math.max(...highs.slice(0, -2));
  const swingLow = Math.min(...lows.slice(0, -2));
  const last = slice.at(-1);
  const open = slice[0].o;
  return {
    resistance: +swingHigh.toFixed(2),
    support: +swingLow.toFixed(2),
    sessionOpen: +open.toFixed(2),
    lastClose: +last.c.toFixed(2),
  };
}

export function prepareChartData(win, session) {
  let bars;
  let barIndex;
  let lookback = win.lookback || 40;

  if (win.bars?.length) {
    bars = enrichBarsWithHistory(win.bars, 52);
    barIndex = bars.length - 1;
  } else if (session.bars && win.barIndex != null) {
    bars = addTimestamps(session.bars);
    barIndex = win.barIndex;
    lookback = win.lookback || 28;
  } else {
    bars = addTimestamps([{ o: 2350, h: 2351, l: 2349, c: 2350 }]);
    barIndex = 0;
  }

  const levels = computeLevels(bars, barIndex);
  return {
    bars,
    barIndex,
    lookback,
    situation: win.situation,
    situationLabel: situationLabel(win.situation),
    levels,
  };
}

export const TIMEFRAMES = ["M15", "H1", "H4", "D1"];
