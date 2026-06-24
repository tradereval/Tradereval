const { openaiJson } = require("../lib/openai");
const { buildReplayMenu, formatMenuForPrompt, resolveReplayPicks } = require("../lib/replay-index");

const SITUATIONS = [
  "trend_pullback",
  "fomo_chase",
  "chop_no_edge",
  "range_fade",
  "fake_breakout",
  "post_loss_pressure",
  "recovery_setup",
  "session_end",
];

const MARKET_SESSIONS = ["ny_open", "london_open", "ny_overlap"];

const SYSTEM = `You are TraderEval's simulation engine for XAUUSD (gold) trader behavior assessment.
Generate unique trading scenarios. Never give live buy/sell signals for real money.
Output valid JSON only.

YOUR MAIN JOB: curate each evaluation from a SHUFFLED menu of real historical replay clips.
- Pick a different replayClipId for every window (no repeats).
- Match situation, label, context, and quiz to that clip's character and price action.
- Vary sessions across windows: ny_open, london_open, ny_overlap.
- Each window MUST use a DIFFERENT situation tag (no repeats on same day).

Situation tags: trend_pullback, fomo_chase, chop_no_edge, range_fade, fake_breakout, post_loss_pressure, recovery_setup, session_end

Keep narratives and context concise (1-2 sentences). Quiz: 4 options, short explain.`;

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function mapDay(day, di, windowsPerDay, resolvedWindows) {
  return {
    day: day.day || di + 1,
    title: day.title || `Day ${di + 1}`,
    narrative: day.narrative || "",
    windows: resolvedWindows.slice(0, windowsPerDay).map((w, wi) => ({
      id: w.id || `d${di + 1}w${wi + 1}`,
      label: w.label || "Decision window",
      context: w.context || "",
      situation: w.situation || "trend_pullback",
      marketSession: w.marketSession || "ny_open",
      replayClipId: w.replayClipId,
      replayMeta: w.replayMeta || null,
      lookback: w.lookback || 36,
      quiz: w.quiz?.question
        ? {
            question: w.quiz.question,
            options: (w.quiz.options || []).slice(0, 4),
            correctIndex: Number(w.quiz.correctIndex) || 0,
            explain: w.quiz.explain || "",
          }
        : null,
    })),
  };
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  try {
    const totalDays = Math.min(30, Math.max(1, Number(req.body?.totalDays) || 3));
    const windowsPerDay = Math.min(4, Math.max(1, Number(req.body?.windowsPerDay) || 2));
    const experience = req.body?.experience || "intermediate";
    const dayIndex = Number(req.body?.dayIndex) || 0;
    const priorContext = String(req.body?.priorContext || "").slice(0, 800);
    const usedReplayIds = Array.isArray(req.body?.usedReplayIds) ? req.body.usedReplayIds : [];
    const shuffleSeed = Number(req.body?.shuffleSeed) || Date.now();

    const menu = buildReplayMenu({
      usedIds: usedReplayIds,
      windowsNeeded: windowsPerDay,
      seed: shuffleSeed + dayIndex * 997,
    });

    const menuText = formatMenuForPrompt(menu);

    const dayPrompt =
      dayIndex > 0
        ? `Create ONLY Day ${dayIndex} of ${totalDays} (${windowsPerDay} decision windows).`
        : `Create Day 1 of ${totalDays} (${windowsPerDay} decision windows).`;

    const user = `${dayPrompt}
Trader experience: ${experience}.
${priorContext ? `Story so far: ${priorContext}` : ""}

SHUFFLED REPLAY MENU — pick one replayClipId per window (never reuse an id):
${menuText || "(no clips available)"}

Instructions:
1. Choose ${windowsPerDay} different replayClipIds from the menu above.
2. Set marketSession to match the clip's session (ny_open / london_open / ny_overlap).
3. Pick situation + write label/context/quiz that fit that clip's character and session move.
4. Shuffle your choices — do not pick clips in date order.

Return JSON:
{
  "symbol": "XAUUSD",
  "daySummary": "one sentence for continuity",
  "days": [{
    "day": ${dayIndex || 1},
    "title": "Day N — ...",
    "narrative": "1-2 sentences",
    "windows": [{
      "id": "d1w1",
      "replayClipId": "ny_open-2025-07-01",
      "label": "NY Open — ...",
      "context": "brief",
      "situation": "trend_pullback",
      "marketSession": "ny_open",
      "lookback": 36,
      "quiz": { "question": "...", "options": ["A","B","C","D"], "correctIndex": 0, "explain": "..." }
    }]
  }]
}`;

    const raw = await openaiJson(SYSTEM, user);
    const rawDay = (raw.days || [])[0] || {};
    const rawWindows = (rawDay.windows || []).slice(0, windowsPerDay);
    const resolved = resolveReplayPicks(rawWindows, menu, usedReplayIds, shuffleSeed + dayIndex);

    const days = [mapDay(rawDay, dayIndex > 0 ? dayIndex - 1 : 0, windowsPerDay, resolved)];
    const newClipIds = resolved.map((w) => w.replayClipId).filter(Boolean);

    return res.status(200).json({
      source: "ai",
      symbol: raw.symbol || "XAUUSD",
      totalDays: dayIndex > 0 ? totalDays : totalDays,
      daySummary: raw.daySummary || "",
      replayClipIds: newClipIds,
      days,
    });
  } catch (err) {
    const code = err.code === "NO_KEY" ? 503 : 500;
    return res.status(code).json({
      error: err.message,
      fallback: true,
    });
  }
};
