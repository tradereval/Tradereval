const KEY = "tradereval_state_v1";

export function defaultState() {
  return {
    evalStarted: false,
    evalComplete: false,
    currentDay: 1,
    currentWindowIdx: 0,
    completedDays: 0,
    actionLog: [],
    simPnlR: 0,
    openPosition: null,
    lastRiskPct: 1,
    consecutiveLosses: 0,
    consecutiveWins: 0,
    report: null,
    profile: {
      experience: "",
      startedAt: null,
    },
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    return { ...defaultState(), ...JSON.parse(raw) };
  } catch {
    return defaultState();
  }
}

export function saveState(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function resetEval() {
  const s = defaultState();
  saveState(s);
  return s;
}

export function getProgress(state, totalDays, totalWindows) {
  const done = state.evalComplete
    ? totalWindows
    : state.currentWindowIdx + (state.currentDay - 1) * (totalWindows / totalDays);
  return Math.min(100, Math.round((state.currentWindowIdx / totalWindows) * 100));
}
