const { verifyPassword, createToken } = require("../lib/crypto");
const { getUser, saveToken, publicUser } = require("../lib/users");
const { withHandler } = require("../lib/http");
const { withEvalPolicy } = require("../lib/evals");

module.exports = withHandler(async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const email = String(req.body?.email || "")
    .trim()
    .toLowerCase();
  const password = String(req.body?.password || "");

  const user = await getUser(email);
  if (!user || !verifyPassword(password, user.salt, user.passwordHash)) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const token = createToken();
  await saveToken(token, email);

  return res.status(200).json({ token, user: withEvalPolicy(user, publicUser) });
});
