const { getEmailByToken, getUser, publicUser } = require("../lib/users");
const { withHandler } = require("../lib/http");

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

const handler = withHandler(async function me(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  const session = await requireUser(req);
  if (!session) return res.status(401).json({ error: "Not signed in." });

  return res.status(200).json({ user: publicUser(session.user) });
});

handler.getToken = getToken;
handler.requireUser = requireUser;
module.exports = handler;
