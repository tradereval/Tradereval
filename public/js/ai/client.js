async function parseJsonResponse(res) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    const gateway = text.includes("504") || text.toLowerCase().includes("timeout");
    throw new Error(
      res.ok
        ? "Invalid server response."
        : gateway
          ? "AI took too long (server timeout). Retrying with a smaller batch…"
          : text.startsWith("A server error")
            ? "Server error — check Vercel deployment logs."
            : text.slice(0, 200)
    );
  }
}

async function fetchWithTimeout(url, options = {}, ms = 60000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("Request timed out. Please try again — each day takes about 15–20 seconds.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function generateOneDay({ dayIndex, totalDays, windowsPerDay, experience, priorContext, shuffleSeed, usedReplayIds }) {
  const res = await fetchWithTimeout(
    "/api/generate-session",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dayIndex,
        totalDays,
        windowsPerDay,
        experience,
        priorContext,
        shuffleSeed,
        usedReplayIds,
      }),
    },
    55000
  );
  const data = await parseJsonResponse(res);
  if (!res.ok) {
    throw new Error(data.error || "Could not generate session day");
  }
  if (data.source !== "ai" || !data.days?.length) {
    throw new Error("Server did not return an AI session day.");
  }
  return data;
}

export async function fetchAiStatus() {
  try {
    const res = await fetchWithTimeout("/api/config", {}, 10000);
    const data = await parseJsonResponse(res);
    if (!res.ok) return { configured: false, model: null };
    return data;
  } catch {
    return { configured: false, model: null };
  }
}

export async function generateAiSession(options = {}) {
  const totalDays = options.totalDays ?? 2;
  const windowsPerDay = options.windowsPerDay ?? 2;
  const experience = options.experience ?? "intermediate";
  const onProgress = options.onProgress;
  const shuffleSeed = options.shuffleSeed ?? Date.now();

  const allDays = [];
  let priorContext = "";
  let usedReplayIds = [];

  for (let day = 1; day <= totalDays; day++) {
    onProgress?.(`Building Day ${day} of ${totalDays}…`, day, totalDays);
    const chunk = await generateOneDay({
      dayIndex: day,
      totalDays,
      windowsPerDay,
      experience,
      priorContext,
      shuffleSeed,
      usedReplayIds,
    });
    allDays.push(...chunk.days);
    priorContext = [priorContext, chunk.daySummary].filter(Boolean).join(" ");
    if (chunk.replayClipIds?.length) {
      usedReplayIds = [...usedReplayIds, ...chunk.replayClipIds];
    }
  }

  return {
    source: "ai",
    symbol: "XAUUSD",
    totalDays: allDays.length,
    shuffleSeed,
    days: allDays,
    generatedAt: Date.now(),
  };
}

export async function evaluateAiSession(payload) {
  const res = await fetchWithTimeout(
    "/api/evaluate-session",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    90000
  );
  const data = await parseJsonResponse(res);
  if (!res.ok) throw new Error(data.error || "Could not evaluate session");
  return data;
}

export async function checkAiAvailable() {
  const status = await fetchAiStatus();
  return status.configured === true;
}
