const { openaiJson } = require("../lib/openai");

const SYSTEM = `You are TraderEval's simulation engine for XAUUSD (gold) trader behavior assessment.
Generate unique, realistic trading scenarios. Never give live buy/sell signals for real money.
Output valid JSON only.

Rules:
- One continuous price story across days (levels carry forward).
- Each window: trade decision moment + one psychology/market judgment quiz.
- bars: exactly 10 OHLC candles {o,h,l,c}, realistic gold 2300-2500, continuous.
- situation tags: trend_pullback, fomo_chase, chop_no_edge, range_fade, fake_breakout, post_loss_pressure, recovery_setup, session_end
- Keep narratives and context concise (1-2 sentences each).
- Quiz: 4 options, short explain (1 sentence).`;

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function normalizeBars(bars, fallbackStart = 2350) {
  if (!Array.isArray(bars) || bars.length < 8) {
    const out = [];
    let p = fallbackStart;
    for (let i = 0; i < 12; i++) {
      const o = p;
      const c = p + (Math.random() - 0.48) * 3;
      const h = Math.max(o, c) + Math.random() * 1.2;
      const l = Math.min(o, c) - Math.random() * 1.2;
      out.push({ o: +o.toFixed(2), h: +h.toFixed(2), l: +l.toFixed(2), c: +c.toFixed(2) });
      p = c;
    }
    return out;
  }
  return bars.slice(0, 14).map((b) => ({
    o: Number(b.o),
    h: Number(b.h),
    l: Number(b.l),
    c: Number(b.c),
  }));
}

function mapDay(day, di, windowsPerDay) {
  return {
    day: day.day || di + 1,
    title: day.title || `Day ${di + 1}`,
    narrative: day.narrative || "",
    windows: (day.windows || []).slice(0, windowsPerDay).map((w, wi) => ({
      id: w.id || `d${di + 1}w${wi + 1}`,
      label: w.label || `Window ${wi + 1}`,
      context: w.context || "",
      situation: w.situation || "trend_pullback",
      lookback: w.lookback || 22,
      bars: normalizeBars(w.bars, 2348 + di * 5 + wi),
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
    const seed = req.body?.seed || Date.now();

    const dayPrompt =
      dayIndex > 0
        ? `Create ONLY Day ${dayIndex} of ${totalDays} for this XAUUSD evaluation session (${windowsPerDay} decision windows on this day).`
        : `Create a ${totalDays}-day XAUUSD evaluation session with ${windowsPerDay} decision windows per day.`;

    const user = `${dayPrompt}
Trader experience: ${experience}.
Seed: ${seed}
${priorContext ? `Story so far: ${priorContext}` : ""}

Return JSON:
{
  "symbol": "XAUUSD",
  "daySummary": "one sentence for continuity to next day",
  "days": [
    {
      "day": ${dayIndex || 1},
      "title": "Day N — ...",
      "narrative": "1-2 sentences",
      "windows": [
        {
          "id": "d1w1",
          "label": "Window 1 — ...",
          "context": "brief",
          "situation": "trend_pullback",
          "lookback": 22,
          "bars": [{"o":2350,"h":2352,"l":2348,"c":2351}],
          "quiz": {
            "question": "judgment question",
            "options": ["A", "B", "C", "D"],
            "correctIndex": 0,
            "explain": "brief"
          }
        }
      ]
    }
  ]
}`;

    const raw = await openaiJson(SYSTEM, user);
    const days = (raw.days || []).map((day, di) => mapDay(day, dayIndex > 0 ? dayIndex - 1 : di, windowsPerDay));

    return res.status(200).json({
      source: "ai",
      symbol: raw.symbol || "XAUUSD",
      totalDays: dayIndex > 0 ? totalDays : days.length || totalDays,
      daySummary: raw.daySummary || "",
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
