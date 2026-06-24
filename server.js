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

http
  .createServer(async (req, res) => {
    const urlPath = req.url.split("?")[0];

    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      });
      res.end();
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
