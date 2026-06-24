const { getEmailByToken, getUser, publicUser } = require("../users");
const { withEvalPolicy } = require("../evals");

function getToken(req) {
  const auth = req.headers.authorization || req.headers.Authorization || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7);
  return req.body?.token || null;
}

async function requireUser(req) {
  const token = getToken(req);
  const email = await getEmailByToken(token);
  if (!email) return null;
  const user = await getUser(email);
  if (!user) return null;
  return { token, user };
}

async function me(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  const session = await requireUser(req);
  if (!session) return res.status(401).json({ error: "Not signed in." });

  return res.status(200).json({ user: withEvalPolicy(session.user, publicUser) });
}

me.getToken = getToken;
me.requireUser = requireUser;

module.exports = me;
