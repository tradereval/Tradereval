export async function generateAiSession(options = {}) {
  const res = await fetch("/api/generate-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      totalDays: options.totalDays ?? 3,
      windowsPerDay: options.windowsPerDay ?? 3,
      experience: options.experience ?? "intermediate",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not generate session");
  return data;
}

export async function evaluateAiSession(payload) {
  const res = await fetch("/api/evaluate-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not evaluate session");
  return data;
}

export async function checkAiAvailable() {
  try {
    const res = await fetch("/api/generate-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ totalDays: 1, windowsPerDay: 1, experience: "ping" }),
    });
    const data = await res.json();
    return res.ok && data.source === "ai";
  } catch {
    return false;
  }
}
