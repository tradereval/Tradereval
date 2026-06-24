const KEY = "tradereval_state_v1";

export function defaultState() {
  return {
    evalStarted: false,
    evalComplete: false,
    evalLoading: false,
    currentDay: 1,
    currentWindowIdx: 0,
    completedDays: 0,
    actionLog: [],
    quizAnswers: [],
    simPnlR: 0,
    openPosition: null,
    lastRiskPct: 1,
    consecutiveLosses: 0,
    consecutiveWins: 0,
    aiSession: null,
    aiPowered: true,
    report: null,
    profile: {
      experience: "intermediate",
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
