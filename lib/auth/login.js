const { verifyPassword, createToken } = require("../crypto");
const { getUser, saveToken, publicUser } = require("../users");
const { withEvalPolicy } = require("../evals");

module.exports = async function login(req, res) {
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
};
