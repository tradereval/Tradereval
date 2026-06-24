const fs = require("fs");
const path = require("path");
const { upstash } = require("./upstash");

const USER_PREFIX = "tradereval:user:";
const TOKEN_PREFIX = "tradereval:token:";
const USERS_FILE = path.join(__dirname, "../../users.json");

function useFile() {
  return !process.env.UPSTASH_REDIS_REST_URL;
}

function readFileUsers() {
  try {
    if (!fs.existsSync(USERS_FILE)) return { users: {}, tokens: {} };
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
  } catch {
    return { users: {}, tokens: {} };
  }
}

function writeFileUsers(data) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2), "utf8");
}

async function getUser(email) {
  const key = email.toLowerCase().trim();
  if (useFile()) {
    const db = readFileUsers();
    return db.users[key] || null;
  }
  const data = await upstash(["GET", USER_PREFIX + key]);
  if (!data?.result) return null;
  return JSON.parse(data.result);
}

async function saveUser(user) {
  const key = user.email.toLowerCase().trim();
  const json = JSON.stringify(user);
  if (useFile()) {
    const db = readFileUsers();
    db.users[key] = user;
    writeFileUsers(db);
    return true;
  }
  await upstash(["SET", USER_PREFIX + key, json]);
  return true;
}

async function saveToken(token, email) {
  const key = email.toLowerCase().trim();
  if (useFile()) {
    const db = readFileUsers();
    db.tokens[token] = key;
    writeFileUsers(db);
    return true;
  }
  await upstash(["SET", TOKEN_PREFIX + token, key, "EX", 60 * 60 * 24 * 90]);
  return true;
}

async function getEmailByToken(token) {
  if (!token) return null;
  if (useFile()) {
    const db = readFileUsers();
    return db.tokens[token] || null;
  }
  const data = await upstash(["GET", TOKEN_PREFIX + token]);
  return data?.result || null;
}

function publicUser(user) {
  return {
    email: user.email,
    name: user.name || "",
    evalCredits: user.evalCredits ?? 0,
    evalsUsed: user.evalsUsed ?? 0,
    createdAt: user.createdAt,
  };
}

module.exports = {
  getUser,
  saveUser,
  saveToken,
  getEmailByToken,
  publicUser,
};
