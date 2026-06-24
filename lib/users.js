const fs = require("fs");
const path = require("path");
const { upstash } = require("./upstash");

const USER_PREFIX = "tradereval:user:";
const TOKEN_PREFIX = "tradereval:token:";
const USERS_FILE = path.join(__dirname, "../users.json");

function hasRedis() {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

function useFile() {
  return !hasRedis() && !process.env.VERCEL;
}

class StorageNotConfiguredError extends Error {
  constructor() {
    super(
      "Sign-up storage is not configured. Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel, then redeploy."
    );
    this.status = 503;
  }
}

function ensureStorageAvailable() {
  if (!hasRedis() && process.env.VERCEL) {
    throw new StorageNotConfiguredError();
  }
}

async function redis(command) {
  const data = await upstash(command);
  if (data === null) {
    const err = new Error("Database unavailable. Check Upstash credentials in Vercel.");
    err.status = 503;
    throw err;
  }
  return data;
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
  ensureStorageAvailable();
  const key = email.toLowerCase().trim();
  if (useFile()) {
    const db = readFileUsers();
    return db.users[key] || null;
  }
  const data = await redis(["GET", USER_PREFIX + key]);
  if (!data?.result) return null;
  return JSON.parse(data.result);
}

async function saveUser(user) {
  ensureStorageAvailable();
  const key = user.email.toLowerCase().trim();
  const json = JSON.stringify(user);
  if (useFile()) {
    const db = readFileUsers();
    db.users[key] = user;
    writeFileUsers(db);
    return true;
  }
  await redis(["SET", USER_PREFIX + key, json]);
  return true;
}

async function saveToken(token, email) {
  ensureStorageAvailable();
  const key = email.toLowerCase().trim();
  if (useFile()) {
    const db = readFileUsers();
    db.tokens[token] = key;
    writeFileUsers(db);
    return true;
  }
  await redis(["SET", TOKEN_PREFIX + token, key, "EX", 60 * 60 * 24 * 90]);
  return true;
}

async function getEmailByToken(token) {
  if (!token) return null;
  ensureStorageAvailable();
  if (useFile()) {
    const db = readFileUsers();
    return db.tokens[token] || null;
  }
  const data = await redis(["GET", TOKEN_PREFIX + token]);
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
  hasRedis,
  StorageNotConfiguredError,
};
