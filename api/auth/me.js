const { getEmailByToken, getUser, publicUser } = require("../lib/users");

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

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

async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  const session = await requireUser(req);
  if (!session) return res.status(401).json({ error: "Not signed in." });

  return res.status(200).json({ user: publicUser(session.user) });
}

handler.getToken = getToken;
handler.requireUser = requireUser;
module.exports = handler;
