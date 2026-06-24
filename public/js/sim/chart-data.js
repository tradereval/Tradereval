/** Each raw bar ≈ 15 minutes unless aggregated for higher TFs */

import { generatePattern, basePriceForWindow } from "./patterns.js";
import { pickReplayClip, formatSessionTime } from "./replay-loader.js";

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
    ...normalizeBar(b),
    t: b.t ?? base.getTime() + i * minutesPerBar * 60_000,
  }));
}

export function normalizeBar(b) {
  const c = Number(b?.c ?? b?.close ?? 2350);
  const o = Number(b?.o ?? b?.open ?? c);
  const h = Number(b?.h ?? b?.high ?? Math.max(o, c));
  const l = Number(b?.l ?? b?.low ?? Math.min(o, c));
  return {
    o: Number.isFinite(o) ? o : 2350,
    h: Number.isFinite(h) ? h : o + 1,
    l: Number.isFinite(l) ? l : o - 1,
    c: Number.isFinite(c) ? c : o,
    t: b?.t,
  };
}

export function normalizeBars(bars) {
  if (!Array.isArray(bars) || !bars.length) {
    return [{ o: 2350, h: 2351, l: 2349, c: 2350 }];
  }
  return bars.map(normalizeBar);
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

  const stitched = [...out, ...normalizeBars(bars)];
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

export async function prepareChartData(win, session, state = {}) {
  const situation = win.situation || "trend_pullback";
  const clip = await pickReplayClip(win);

  if (clip?.bars?.length) {
    const bars = normalizeBars(clip.bars);
    const barIndex = bars.length - 1;
    const lookback = Math.min(win.lookback || 40, bars.length);
    const bar = bars[barIndex] ?? bars.at(-1);
    const levels = computeLevels(bars, barIndex);
    const markerBar = clip.markerBar ?? Math.floor(bars.length * 0.65);

    return {
      bar,
      bars,
      barIndex,
      lookback,
      situation,
      situationLabel: situationLabel(situation),
      patternType: clip.sessionKey || win.marketSession,
      replayDate: clip.date,
      sessionLabel: clip.sessionLabel,
      sessionTime: formatSessionTime(bar.t),
      markerBar,
      isReplay: true,
      levels: {
        ...levels,
        sessionOpen: bars[markerBar]?.o ?? levels.sessionOpen,
      },
    };
  }

  const day = win.day || state.currentDay || 1;
  const seedKey = `${session?.symbol || "XAUUSD"}-${state.aiSession?.generatedAt || state.profile?.startedAt || ""}-${win.id}`;
  const base = basePriceForWindow(win, day, hashSeedSimple(seedKey));
  const patternBars = generatePattern(situation, seedKey, base);
  const bars = addTimestamps(patternBars, 15, 7 + (day - 1) * 2);
  const barIndex = bars.length - 1;
  const lookback = Math.min(win.lookback || 40, bars.length);
  const bar = bars[barIndex] ?? bars.at(-1);
  const levels = computeLevels(bars, barIndex);

  return {
    bar,
    bars,
    barIndex,
    lookback,
    situation,
    situationLabel: situationLabel(situation),
    patternType: situation,
    isReplay: false,
    levels,
  };
}

function hashSeedSimple(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

export const TIMEFRAMES = ["M15", "H1", "H4", "D1"];
