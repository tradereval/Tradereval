const crypto = require("crypto");

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 32, "sha256").toString("hex");
}

function createSalt() {
  return crypto.randomBytes(16).toString("hex");
}

function createToken() {
  return crypto.randomBytes(32).toString("hex");
}

function verifyPassword(password, salt, hash) {
  return hashPassword(password, salt) === hash;
}

module.exports = { hashPassword, createSalt, createToken, verifyPassword };
