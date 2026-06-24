const { requireUser } = require("../auth/me");
const { saveUser, publicUser } = require("../lib/users");
const { withHandler } = require("../lib/http");
const { isUnlimitedEvals, canUserEvaluate, withEvalPolicy } = require("../lib/evals");

module.exports = withHandler(async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const session = await requireUser(req);
  if (!session) return res.status(401).json({ error: "Sign in required." });

  const { user } = session;
  const unlimited = isUnlimitedEvals();

  if (req.body?.checkOnly) {
    return res.status(200).json({
      ok: true,
      unlimited,
      canEvaluate: canUserEvaluate(user),
      user: withEvalPolicy(user, publicUser),
    });
  }

  if (!canUserEvaluate(user)) {
    return res.status(403).json({
      error: "No free evaluations left. Join the waitlist for the next release.",
      user: withEvalPolicy(user, publicUser),
    });
  }

  if (!unlimited) {
    user.evalCredits -= 1;
  }
  user.evalsUsed = (user.evalsUsed ?? 0) + 1;
  user.lastEvalAt = new Date().toISOString();
  await saveUser(user);

  return res.status(200).json({
    ok: true,
    unlimited,
    consumed: !unlimited,
    user: withEvalPolicy(user, publicUser),
    message: unlimited ? "Evaluation started (testing mode)." : "1 free evaluation activated.",
  });
});
