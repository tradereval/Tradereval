const { openaiJson } = require("./lib/openai");

const SYSTEM = `You are an expert trading psychology coach for TraderEval.
Evaluate trader BEHAVIOR from their actions and quiz answers — not P&L alone.
Never recommend live trades or specific entries on real markets.
Output valid JSON only. Be direct, supportive, specific to their data.`;

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  try {
    const { actionLog = [], quizAnswers = [], simPnlR = 0, session = {} } = req.body || {};

    const user = `Evaluate this trader session.

Session meta: ${JSON.stringify({ symbol: session.symbol, totalDays: session.totalDays, source: session.source })}

Actions (what they DID):
${JSON.stringify(actionLog, null, 2)}

Quiz answers (index chosen, correctIndex in scenario):
${JSON.stringify(quizAnswers, null, 2)}

Sim P&L in R: ${simPnlR}

Return JSON:
{
  "overall": 0-100,
  "archetype": { "name": "The ...", "summary": "2-3 sentences on who they are as a trader" },
  "map": {
    "psychology": 0-100,
    "risk": 0-100,
    "strategy": 0-100,
    "execution": 0-100,
    "market": 0-100,
    "consistency": 0-100,
    "recovery": 0-100,
    "journaling": 50
  },
  "behavior": {
    "pass_rate": 0-1,
    "good_stop_rate": 0-1,
    "no_stop": number,
    "oversize": number,
    "chase_entries": number,
    "chop_entries": number,
    "size_after_loss": number,
    "quiz_score": 0-1
  },
  "criticalMoments": [
    { "day": 1, "label": "...", "action": "...", "note": "coaching note" }
  ],
  "fixes": ["fix 1", "fix 2", "fix 3"],
  "aiCoaching": "3-5 paragraph personalized report: mistakes, patterns, how to improve. Reference their actual choices."
}`;

    const report = await openaiJson(SYSTEM, user);
    report.simPnlR = simPnlR;
    report.aiPowered = true;
    report.generatedAt = new Date().toISOString();

    return res.status(200).json(report);
  } catch (err) {
    return res.status(err.code === "NO_KEY" ? 503 : 500).json({
      error: err.message,
      fallback: true,
    });
  }
};
