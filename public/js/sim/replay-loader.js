/** Load real XAUUSD session replay clips (NY open, London, etc.) */

const SESSION_LABELS = {
  ny_open: "NY Open",
  london_open: "London Open",
  ny_overlap: "London–NY Overlap",
};

let library = null;
let clipMap = null;
let loadPromise = null;

export function sessionLabel(key) {
  return SESSION_LABELS[key] || key?.replace(/_/g, " ") || "Session";
}

export async function loadReplayLibrary() {
  if (library) return library;
  if (loadPromise) return loadPromise;

  loadPromise = fetch("/data/replay-clips.json")
    .then((res) => {
      if (!res.ok) throw new Error("Replay data not found");
      return res.json();
    })
    .then((data) => {
      library = data;
      clipMap = new Map();
      for (const clips of Object.values(data.sessions || {})) {
        for (const c of clips) clipMap.set(c.id, c);
      }
      return library;
    })
    .catch((err) => {
      console.warn("Replay library unavailable:", err.message);
      library = { sessions: {} };
      clipMap = new Map();
      return library;
    });

  return loadPromise;
}

function clipFromId(id) {
  if (!id || !clipMap) return null;
  const clip = clipMap.get(id);
  if (!clip) return null;
  return {
    ...clip,
    sessionKey: clip.session,
    sessionLabel: clip.sessionLabel || sessionLabel(clip.session),
    bars: clip.bars.map((b) => ({ ...b })),
  };
}

/** Use OpenAI-assigned replayClipId from the session window */
export async function pickReplayClip(win) {
  await loadReplayLibrary();
  if (!win.replayClipId) return null;
  return clipFromId(win.replayClipId);
}

export function formatSessionTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/New_York",
    hour12: true,
  });
}
