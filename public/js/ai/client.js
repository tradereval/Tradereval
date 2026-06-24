async function parseJsonResponse(res) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      res.ok
        ? "Invalid server response."
        : text.startsWith("A server error")
          ? "Server error — check Vercel deployment logs."
          : text.slice(0, 200)
    );
  }
}

export async function fetchAiStatus() {
  try {
    const res = await fetch("/api/config");
    const data = await parseJsonResponse(res);
    if (!res.ok) return { configured: false, model: null };
    return data;
  } catch {
    return { configured: false, model: null };
  }
}

export async function generateAiSession(options = {}) {
  const res = await fetch("/api/generate-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      totalDays: options.totalDays ?? 3,
      windowsPerDay: options.windowsPerDay ?? 2,
      experience: options.experience ?? "intermediate",
    }),
  });
  const data = await parseJsonResponse(res);
  if (!res.ok) {
    const msg =
      data.error ||
      (data.fallback ? "AI not configured on server." : "Could not generate session");
    throw new Error(msg);
  }
  if (data.source !== "ai") {
    throw new Error("Server did not return an AI session.");
  }
  return data;
}

export async function evaluateAiSession(payload) {
  const res = await fetch("/api/evaluate-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await parseJsonResponse(res);
  if (!res.ok) throw new Error(data.error || "Could not evaluate session");
  return data;
}

export async function checkAiAvailable() {
  const status = await fetchAiStatus();
  return status.configured === true;
}
