/**
 * Production wishlist API for tradereval.com (Vercel serverless)
 *
 * Set in Vercel → Settings → Environment Variables:
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 * (Free at upstash.com — Redis database, copy REST credentials)
 *
 * Optional fallback:
 *   FORMSPREE_URL = https://formspree.io/f/xxxxx
 */

const EMAILS_KEY = "tradereval:wishlist:emails";
const ENTRIES_KEY = "tradereval:wishlist:entries";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

async function upstash(command) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  if (!res.ok) return null;
  return res.json();
}

async function getCount() {
  const data = await upstash(["SCARD", EMAILS_KEY]);
  if (data?.result != null) return Number(data.result);
  return null;
}

async function saveEntry(entry) {
  const added = await upstash(["SADD", EMAILS_KEY, entry.email]);
  await upstash(["LPUSH", ENTRIES_KEY, JSON.stringify(entry)]);
  const count = await getCount();
  const isNew = added?.result === 1;
  return { ok: true, duplicate: !isNew, count: count ?? 0 };
}

async function saveFormspree(entry) {
  const url = process.env.FORMSPREE_URL;
  if (!url) return null;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(entry),
  });
  if (!res.ok) return null;
  return { ok: true, via: "formspree" };
}

export default async function handler(req, res) {
  cors(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method === "GET") {
    const count = await getCount();
    return res.status(200).json({ count: count ?? 0, configured: count != null });
  }

  if (req.method === "POST") {
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Valid email required." });
    }

    const entry = {
      email,
      name: String(req.body?.name || "").trim(),
      experience: req.body?.experience || "",
      market: req.body?.market || "",
      source: req.body?.source || "tradereval.com",
      joinedAt: req.body?.joinedAt || new Date().toISOString(),
    };

    if (process.env.UPSTASH_REDIS_REST_URL) {
      const result = await saveEntry(entry);
      return res.status(200).json(result);
    }

    const formspree = await saveFormspree(entry);
    if (formspree) {
      return res.status(200).json({ ok: true, count: null });
    }

    return res.status(503).json({
      error: "Waitlist storage not configured. Add Upstash or Formspree env vars in Vercel.",
    });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
