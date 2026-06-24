import { SIM_CONFIG, getTotalWindows as staticTotalWindows } from "../data/simulation.js";

export function getSession(state) {
  if (state.aiSession?.days?.length) {
    return {
      ...state.aiSession,
      source: state.aiSession.source || "ai",
    };
  }
  return {
    source: "static",
    symbol: SIM_CONFIG.symbol,
    totalDays: SIM_CONFIG.totalDays,
    days: SIM_CONFIG.days,
    bars: SIM_CONFIG.bars,
  };
}

export function getTotalWindows(state) {
  const session = getSession(state);
  if (session.source === "static") return staticTotalWindows();
  return session.days.reduce((n, d) => n + (d.windows?.length || 0), 0);
}

export function getCurrentWindow(state) {
  let count = 0;
  const session = getSession(state);
  for (const dayCfg of session.days) {
    for (const win of dayCfg.windows || []) {
      if (count === state.currentWindowIdx) {
        return { dayCfg, win, session };
      }
      count++;
    }
  }
  return null;
}

export function getWindowBar(win, session) {
  if (win.bars?.length) {
    const bar = win.bars[win.bars.length - 1];
    return { bar, bars: win.bars, lookback: win.lookback || 22 };
  }
  if (session.bars && win.barIndex != null) {
    return {
      bar: session.bars[win.barIndex],
      bars: session.bars,
      lookback: win.lookback || 22,
      barIndex: win.barIndex,
    };
  }
  return { bar: { c: 2350 }, bars: [{ o: 2350, h: 2351, l: 2349, c: 2350 }], lookback: 20 };
}

export function sessionMeta(state) {
  const s = getSession(state);
  return {
    symbol: s.symbol || "XAUUSD",
    totalDays: s.totalDays || s.days?.length || 3,
    source: s.source,
  };
}
