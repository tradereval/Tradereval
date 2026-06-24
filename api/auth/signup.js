const { hashPassword, createSalt, createToken, verifyPassword } = require("../lib/crypto");
const { getUser, saveUser, saveToken, publicUser } = require("../lib/users");

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const email = String(req.body?.email || "")
    .trim()
    .toLowerCase();
  const name = String(req.body?.name || "").trim();
  const password = String(req.body?.password || "");

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Valid email required." });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  }

  const existing = await getUser(email);
  if (existing) {
    return res.status(409).json({ error: "Email already registered. Please sign in." });
  }

  const salt = createSalt();
  const user = {
    email,
    name,
    passwordHash: hashPassword(password, salt),
    salt,
    evalCredits: 1,
    evalsUsed: 0,
    createdAt: new Date().toISOString(),
  };

  await saveUser(user);
  const token = createToken();
  await saveToken(token, email);

  return res.status(200).json({
    token,
    user: publicUser(user),
    message: "Account created. You have 1 free evaluation.",
  });
};
