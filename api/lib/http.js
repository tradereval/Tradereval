function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function sendError(res, err) {
  const status = err.status || 500;
  const message =
    status === 500
      ? "Something went wrong. Please try again."
      : err.message || "Request failed.";
  return res.status(status).json({ error: message });
}

function withHandler(handler) {
  return async function wrapped(req, res) {
    cors(res);
    if (req.method === "OPTIONS") return res.status(204).end();
    try {
      return await handler(req, res);
    } catch (err) {
      console.error(err);
      return sendError(res, err);
    }
  };
}

module.exports = { cors, sendError, withHandler };
