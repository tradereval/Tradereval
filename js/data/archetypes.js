export const ARCHETYPES = [
  {
    id: "sniper",
    name: "The Patient Sniper",
    summary:
      "You wait for quality and respect no-trade zones. You may miss some moves, but your process is selective.",
    triggers: ["high_pass_rate", "good_stops", "low_overtrade"],
  },
  {
    id: "disciplined",
    name: "The Disciplined Operator",
    summary:
      "Rules matter to you. Stops and sizing are mostly consistent. You trade like you have a plan.",
    triggers: ["good_stops", "stable_risk", "few_rule_breaks"],
  },
  {
    id: "reactor",
    name: "The Emotional Reactor",
    summary:
      "Your behavior shifts after wins and losses. Size and frequency change when pressure hits.",
    triggers: ["size_after_loss", "tilt", "inconsistent_risk"],
  },
  {
    id: "gambler",
    name: "The Risk Gambler",
    summary:
      "You chase moves and size up when you should pull back. Stops are optional in your playbook.",
    triggers: ["no_stop", "oversize", "chase_entries"],
  },
  {
    id: "overtrader",
    name: "The Overtrader",
    summary:
      "Sitting out is hard — especially in chop. You turn low-edge moments into unnecessary risk.",
    triggers: ["overtrade", "chop_entries", "low_pass_in_chop"],
  },
  {
    id: "developing",
    name: "The Developing Trader",
    summary:
      "Mixed habits — flashes of discipline alongside recurring leaks. Normal stage with clear room to grow.",
    triggers: ["default"],
  },
];

export function pickArchetype(tags, scores) {
  const counts = {
    sniper: 0,
    disciplined: 0,
    reactor: 0,
    gambler: 0,
    overtrader: 0,
  };

  if (tags.pass_rate >= 0.35 && tags.good_stop_rate >= 0.7) counts.sniper += 3;
  if (tags.good_stop_rate >= 0.75 && tags.risk_variance < 1.5) counts.disciplined += 3;
  if (tags.size_after_loss >= 1 || tags.tilt_events >= 2) counts.reactor += 4;
  if (tags.no_stop >= 2 || tags.oversize >= 2 || tags.chase_entries >= 2) counts.gambler += 4;
  if (tags.chop_entries >= 2 || (tags.overtrade >= 2 && tags.pass_rate < 0.2))
    counts.overtrader += 4;

  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (best[1] === 0) return ARCHETYPES.find((a) => a.id === "developing");
  return ARCHETYPES.find((a) => a.id === best[0]) ?? ARCHETYPES.at(-1);
}
