const { requireUser } = require("../auth/me");
const { saveUser, publicUser } = require("../lib/users");

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const session = await requireUser(req);
  if (!session) return res.status(401).json({ error: "Sign in required." });

  const { user } = session;

  if (req.body?.checkOnly) {
    return res.status(200).json({
      ok: true,
      canEvaluate: (user.evalCredits ?? 0) > 0,
      user: publicUser(user),
    });
  }

  if ((user.evalCredits ?? 0) < 1) {
    return res.status(403).json({
      error: "No free evaluations left. Join the waitlist for the next release.",
      user: publicUser(user),
    });
  }

  user.evalCredits -= 1;
  user.evalsUsed = (user.evalsUsed ?? 0) + 1;
  user.lastEvalAt = new Date().toISOString();
  await saveUser(user);

  return res.status(200).json({
    ok: true,
    consumed: true,
    user: publicUser(user),
    message: "1 free evaluation activated.",
  });
};
