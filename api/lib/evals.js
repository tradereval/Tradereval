/** Unlimited evals for testing. Set UNLIMITED_EVALS=false in Vercel before public launch. */
function isUnlimitedEvals() {
  const v = process.env.UNLIMITED_EVALS;
  if (v === "false" || v === "0") return false;
  return true;
}

function canUserEvaluate(user) {
  return isUnlimitedEvals() || (user.evalCredits ?? 0) > 0;
}

function withEvalPolicy(user, basePublicUser) {
  const u = basePublicUser(user);
  u.unlimitedEvals = isUnlimitedEvals();
  if (u.unlimitedEvals) u.evalCredits = null;
  return u;
}

module.exports = { isUnlimitedEvals, canUserEvaluate, withEvalPolicy };
