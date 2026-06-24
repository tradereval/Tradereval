const { withHandler } = require("../../lib/http");
const signup = require("../../lib/auth/signup");
const login = require("../../lib/auth/login");
const me = require("../../lib/auth/me");

const routes = { signup, login, me };

module.exports = withHandler(async function authRouter(req, res) {
  const action = req.query?.action;
  const route = routes[action];
  if (!route) return res.status(404).json({ error: "Unknown auth route." });
  return route(req, res);
});

module.exports.requireUser = me.requireUser;
module.exports.getToken = me.getToken;
