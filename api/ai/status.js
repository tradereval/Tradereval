const { isUnlimitedEvals } = require("../lib/evals");

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  const configured = !!process.env.OPENAI_API_KEY;
  return res.status(200).json({
    configured,
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    unlimitedEvals: isUnlimitedEvals(),
  });
};
