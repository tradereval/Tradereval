const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const publicRoot = path.join(root, "public");
const port = 8080;
const wishlistFile = path.join(root, "wishlist.json");

const mime = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
};

function readWishlist() {
  try {
    if (!fs.existsSync(wishlistFile)) return [];
    return JSON.parse(fs.readFileSync(wishlistFile, "utf8"));
  } catch {
    return [];
  }
}

function writeWishlist(list) {
  fs.writeFileSync(wishlistFile, JSON.stringify(list, null, 2), "utf8");
}

function sendJson(res, code, data) {
  res.writeHead(code, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1e6) reject(new Error("Too large"));
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(data || "{}"));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function createVercelRes(nodeRes) {
  const out = {
    statusCode: 200,
    setHeader(k, v) {
      nodeRes.setHeader(k, v);
      return out;
    },
    status(code) {
      out.statusCode = code;
      return out;
    },
    json(data) {
      sendJson(nodeRes, out.statusCode, data);
    },
    end(msg) {
      nodeRes.end(msg || "");
    },
  };
  return out;
}

const generateSession = require("./api/generate-session");
const evaluateSession = require("./api/evaluate-session");
const authRouter = require("./api/auth/[action]");
const evalConsume = require("./api/eval/consume");
const apiConfig = require("./api/config");

const API_POST = {
  "/api/generate-session": generateSession,
  "/api/evaluate-session": evaluateSession,
  "/api/auth/signup": (req, res) => authRouter({ ...req, query: { action: "signup" } }, res),
  "/api/auth/login": (req, res) => authRouter({ ...req, query: { action: "login" } }, res),
  "/api/eval/consume": evalConsume,
};

http
  .createServer(async (req, res) => {
    const urlPath = req.url.split("?")[0];

    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      });
      res.end();
      return;
    }

    if (API_POST[urlPath] && req.method === "POST") {
      try {
        req.body = await readBody(req);
        await API_POST[urlPath](req, createVercelRes(res));
      } catch (err) {
        sendJson(res, 500, { error: err.message });
      }
      return;
    }

    if (urlPath === "/api/auth/me" && req.method === "GET") {
      try {
        await authRouter({ ...req, query: { action: "me" } }, createVercelRes(res));
      } catch (err) {
        sendJson(res, 500, { error: err.message });
      }
      return;
    }

    if (urlPath === "/api/config" && req.method === "GET") {
      try {
        await apiConfig(req, createVercelRes(res));
      } catch (err) {
        sendJson(res, 500, { error: err.message });
      }
      return;
    }

    if (urlPath === "/api/wishlist/count" && req.method === "GET") {
      const list = readWishlist();
      sendJson(res, 200, { count: list.length });
      return;
    }

    if (urlPath === "/api/wishlist" && req.method === "GET") {
      const list = readWishlist();
      sendJson(res, 200, { count: list.length, configured: true });
      return;
    }

    if (urlPath === "/api/wishlist" && req.method === "POST") {
      try {
        const body = await readBody(req);
        const email = String(body.email || "")
          .trim()
          .toLowerCase();

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          sendJson(res, 400, { error: "Valid email required." });
          return;
        }

        const list = readWishlist();
        if (list.some((e) => e.email === email)) {
          sendJson(res, 200, { ok: true, duplicate: true, count: list.length });
          return;
        }

        list.push({
          email,
          name: String(body.name || "").trim(),
          experience: body.experience || "",
          market: body.market || "",
          source: body.source || "website",
          joinedAt: body.joinedAt || new Date().toISOString(),
        });

        writeWishlist(list);
        console.log(`  + Waitlist: ${email} (total: ${list.length})`);
        sendJson(res, 200, { ok: true, count: list.length });
      } catch (err) {
        sendJson(res, 500, { error: err.message || "Server error" });
      }
      return;
    }

    let filePath = path.join(publicRoot, urlPath === "/" ? "index.html" : urlPath);

    if (!filePath.startsWith(publicRoot)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      res.writeHead(200, { "Content-Type": mime[path.extname(filePath)] || "text/plain" });
      res.end(data);
    });
  })
  .listen(port, () => {
    const list = readWishlist();
    console.log("");
    console.log("  TraderEval is running!");
    console.log("  Open: http://localhost:" + port);
    console.log("  Waitlist signups saved to: wishlist.json");
    console.log("  Current waitlist size: " + list.length);
    console.log("  Press Ctrl+C to stop.");
    console.log("");
  });
