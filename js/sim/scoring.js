import { DIMENSIONS } from "../data/dimensions.js";
import { pickArchetype } from "../data/archetypes.js";

const RISK_LEVELS = { 0.5: 1, 1: 2, 2: 3, 5: 0 };

function tagAction(action, windowMeta, state) {
  const tags = [];
  const { situation } = windowMeta;
  const a = action.action;

  if (a === "pass") {
    tags.push("pass");
    if (["chop_no_edge", "fomo_chase", "fake_breakout"].includes(situation))
      tags.push("good_pass");
    if (["trend_pullback", "recovery_setup"].includes(situation))
      tags.push("missed_valid_or_cautious");
    return tags;
  }

  if (a === "close") {
    tags.push("close");
    if (situation === "session_end" || situation === "week_close") tags.push("good_close");
    return tags;
  }

  if (a === "hold") {
    tags.push("hold");
    return tags;
  }

  // entry long/short
  if (!action.hasStop) tags.push("no_stop");
  else tags.push("has_stop");

  if (action.riskPct >= 5) tags.push("oversize");
  else if (action.riskPct >= 2) tags.push("elevated_risk");
  else tags.push("normal_risk");

  if (state.simPnlR < -1 && action.riskPct >= (state.lastRiskPct || 1)) {
    tags.push("size_after_loss");
  }
  if (state.consecutiveLosses >= 1 && a !== "pass" && action.riskPct > 2) {
    tags.push("tilt");
  }

  if (situation === "fomo_chase" && a === "long") tags.push("chase_entry");
  if (situation === "chop_no_edge" && a !== "pass") tags.push("chop_entry");
  if (situation === "fake_breakout" && a === "long") tags.push("chase_entry");
  if (situation === "post_loss_pressure" && action.riskPct >= 2) tags.push("double_down");
  if (situation === "range_fade" && a === "long") tags.push("wrong_side_range");

  tags.push(a === "long" ? "entered_long" : "entered_short");
  return tags;
}

export function recordAction(state, payload) {
  const tags = tagAction(payload, payload.windowMeta, state);
  const entry = {
    ...payload,
    tags,
    ts: Date.now(),
  };

  let pnlDeltaR = 0;
  if (payload.action === "pass" || payload.action === "hold") {
    // no pnl change
  } else if (payload.action === "close" && state.openPosition) {
    pnlDeltaR = estimateCloseR(state, payload.price);
  } else if (payload.action === "long" || payload.action === "short") {
    state.openPosition = {
      dir: payload.action,
      entry: payload.price,
      riskPct: payload.riskPct,
      hasStop: payload.hasStop,
      day: payload.day,
      windowId: payload.windowId,
    };
    state.lastRiskPct = payload.riskPct;
  }

  state.actionLog.push(entry);
  state.simPnlR += pnlDeltaR;
  if (pnlDeltaR < 0) {
    state.consecutiveLosses++;
    state.consecutiveWins = 0;
  } else if (pnlDeltaR > 0) {
    state.consecutiveWins++;
    state.consecutiveLosses = 0;
  }

  if (payload.action === "close") state.openPosition = null;

  return entry;
}

function estimateCloseR(state, price) {
  const pos = state.openPosition;
  if (!pos) return 0;
  const diff = pos.dir === "long" ? price - pos.entry : pos.entry - price;
  const r = diff / 8;
  if (!pos.hasStop) return r * 1.2;
  return Math.max(-1, Math.min(2.5, r));
}

export function buildBehaviorSummary(actionLog) {
  const allTags = actionLog.flatMap((a) => a.tags);
  const entries = actionLog.filter((a) => a.action === "long" || a.action === "short");
  const passes = actionLog.filter((a) => a.action === "pass").length;
  const total = actionLog.length || 1;

  const riskPcts = entries.map((e) => e.riskPct).filter(Boolean);
  const avgRisk = riskPcts.length ? riskPcts.reduce((a, b) => a + b, 0) / riskPcts.length : 0;
  const riskVariance =
    riskPcts.length > 1
      ? Math.sqrt(
          riskPcts.reduce((s, r) => s + (r - avgRisk) ** 2, 0) / riskPcts.length
        )
      : 0;

  return {
    pass_rate: passes / total,
    good_stop_rate: entries.length
      ? entries.filter((e) => e.hasStop).length / entries.length
      : 1,
    no_stop: allTags.filter((t) => t === "no_stop").length,
    oversize: allTags.filter((t) => t === "oversize").length,
    chase_entries: allTags.filter((t) => t === "chase_entry").length,
    chop_entries: allTags.filter((t) => t === "chop_entry").length,
    size_after_loss: allTags.filter((t) => t === "size_after_loss").length,
    tilt_events: allTags.filter((t) => t === "tilt").length,
    overtrade: entries.length,
    good_pass: allTags.filter((t) => t === "good_pass").length,
    risk_variance: riskVariance,
    total_actions: total,
    total_entries: entries.length,
  };
}

export function computeDimensionScores(actionLog, simPnlR) {
  const b = buildBehaviorSummary(actionLog);

  const psychology = clamp(
    72 -
      b.tilt_events * 12 -
      b.size_after_loss * 10 -
      b.oversize * 8 +
      b.good_pass * 4
  );

  const risk = clamp(
    78 -
      b.no_stop * 15 -
      b.oversize * 12 -
      b.risk_variance * 5 +
      b.good_stop_rate * 20
  );

  const execution = clamp(
    70 - b.chase_entries * 14 - b.chop_entries * 10 + b.good_pass * 5
  );

  const strategy = clamp(65 + b.pass_rate * 25 - b.chop_entries * 8 + b.good_pass * 3);

  b.wrong_side = actionLog.flatMap((a) => a.tags).filter((t) => t === "wrong_side_range").length;

  const market = clamp(68 + b.good_pass * 6 - b.wrong_side * 10);

  const consistency = clamp(70 - b.risk_variance * 8 + (b.total_actions > 5 ? 5 : 0));

  const recovery = clamp(65 - b.size_after_loss * 12 + (simPnlR > -2 ? 8 : -5));

  const journaling = 50;

  const map = {
    psychology,
    risk,
    strategy,
    execution,
    market,
    journaling,
    consistency,
    recovery,
  };

  let weighted = 0;
  let wSum = 0;
  for (const d of DIMENSIONS) {
    if (d.id === "journaling") continue;
    const s = map[d.id] ?? 60;
    weighted += s * d.weight;
    wSum += d.weight;
  }
  const overall = Math.round(weighted / wSum);

  return { map, overall, behavior: b };
}

function clamp(n) {
  return Math.max(25, Math.min(98, Math.round(n)));
}

export function generateReport(state) {
  const { map, overall, behavior } = computeDimensionScores(
    state.actionLog,
    state.simPnlR
  );
  const archetype = pickArchetype(behavior, map);

  const criticalMoments = state.actionLog
    .filter((a) =>
      a.tags.some((t) =>
        ["no_stop", "oversize", "chase_entry", "chop_entry", "size_after_loss", "good_pass"].includes(
          t
        )
      )
    )
    .slice(0, 8)
    .map((a) => ({
      day: a.day,
      label: a.windowLabel,
      action: formatAction(a),
      note: momentNote(a),
    }));

  const fixes = buildFixes(behavior, map);

  return {
    overall,
    map,
    behavior,
    archetype,
    criticalMoments,
    fixes,
    simPnlR: state.simPnlR,
    completedDays: state.completedDays,
    actionCount: state.actionLog.length,
    generatedAt: new Date().toISOString(),
  };
}

function formatAction(a) {
  if (a.action === "pass") return "Passed (no trade)";
  if (a.action === "close") return "Closed position";
  if (a.action === "hold") return "Held position";
  return `${a.action.toUpperCase()} · ${a.riskPct}% risk · stop ${a.hasStop ? "yes" : "NO"}`;
}

function momentNote(a) {
  if (a.tags.includes("no_stop")) return "Entered without a stop — high risk behavior.";
  if (a.tags.includes("oversize")) return "Oversized relative to sensible risk limits.";
  if (a.tags.includes("chase_entry")) return "Chased an extended move — FOMO pattern.";
  if (a.tags.includes("chop_entry")) return "Traded inside chop with no clear edge.";
  if (a.tags.includes("size_after_loss")) return "Sized up or maintained aggression after losses.";
  if (a.tags.includes("good_pass")) return "Good discipline — passed on a low-edge moment.";
  return "Notable decision in this window.";
}

function buildFixes(behavior, scores) {
  const fixes = [];
  if (behavior.no_stop > 0)
    fixes.push("Mandatory rule: no entry without a stop placed first — every single time.");
  if (behavior.oversize > 0 || scores.risk < 65)
    fixes.push("Cap risk at 1% per trade until you complete 20 logged trades with discipline.");
  if (behavior.chop_entries > 0 || scores.execution < 65)
    fixes.push("In range/chop days, your default is PASS unless structure is obvious.");
  if (behavior.size_after_loss > 0 || scores.psychology < 65)
    fixes.push("After a red day, next trade must be half size or no trade — non-negotiable.");
  if (behavior.chase_entries > 0)
    fixes.push("If you missed the move, you missed it. No chasing — wait for the next A setup.");
  if (fixes.length < 3)
    fixes.push("Re-run the full 30-day evaluation in 3 weeks and compare your behavior scores.");
  return fixes.slice(0, 3);
}

export { RISK_LEVELS };
