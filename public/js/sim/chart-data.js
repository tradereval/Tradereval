/** Chart data prep — real gold anchors from replay clips */

import { pickReplayClip, formatSessionTime } from "./replay-loader.js";
import { loadBarsForTimeframe } from "./gold-data.js";

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

export function situationLabel(key) {
  return SITUATION_LABELS[key] || key?.replace(/_/g, " ") || "Decision window";
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
  const window = Math.min(60, Math.max(20, Math.floor(bars.length * 0.25)));
  const slice = bars.slice(Math.max(0, endIndex - window), endIndex + 1);
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

export async function prepareChartMeta(win) {
  const situation = win.situation || "trend_pullback";
  const clip = await pickReplayClip(win);

  if (!clip?.bars?.length) {
    return { situation, situationLabel: situationLabel(situation), isReal: false };
  }

  const anchorTs = clip.bars.at(-1).t;
  const markerBar = clip.markerBar ?? 32;
  const markerTs = clip.bars[markerBar]?.t ?? anchorTs;

  return {
    situation,
    situationLabel: situationLabel(situation),
    isReal: true,
    anchorTs,
    markerTs,
    markerBar,
    replayDate: clip.date,
    sessionLabel: clip.sessionLabel,
    sessionTime: formatSessionTime(anchorTs),
    marketSession: clip.sessionKey || win.marketSession,
    replayMeta: win.replayMeta,
  };
}

export async function loadChartBars(tf, meta) {
  if (!meta?.anchorTs) return [];
  const bars = await loadBarsForTimeframe(tf, meta.anchorTs);
  return bars.map(normalizeBar);
}

export { TIMEFRAMES } from "./gold-data.js";
