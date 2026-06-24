export const DIMENSIONS = [
  {
    id: "psychology",
    name: "Psychology & Emotions",
    weight: 0.15,
    color: "#a78bfa",
    description: "Emotional control, FOMO, revenge trading, patience under drawdown.",
    sources: ["quiz", "journal", "self"],
  },
  {
    id: "risk",
    name: "Risk Management",
    weight: 0.2,
    color: "#f87171",
    description: "Position sizing, stop placement, max daily loss, R-multiple discipline.",
    sources: ["quiz", "journal", "self"],
  },
  {
    id: "strategy",
    name: "Strategy & Edge",
    weight: 0.15,
    color: "#38bdf8",
    description: "Defined setup, backtest awareness, expectancy, market fit.",
    sources: ["quiz", "self"],
  },
  {
    id: "execution",
    name: "Execution & Discipline",
    weight: 0.15,
    color: "#34d399",
    description: "Plan adherence, entry/exit rules, avoiding impulsive trades.",
    sources: ["quiz", "journal", "self"],
  },
  {
    id: "market",
    name: "Market Knowledge",
    weight: 0.1,
    color: "#fbbf24",
    description: "Sessions, structure, volatility, instrument behavior.",
    sources: ["quiz"],
  },
  {
    id: "journaling",
    name: "Journaling Quality",
    weight: 0.1,
    color: "#fb923c",
    description: "Consistency, depth of review, lessons captured.",
    sources: ["journal"],
  },
  {
    id: "consistency",
    name: "Consistency",
    weight: 0.1,
    color: "#2dd4bf",
    description: "Routine, sample size, process over outcomes.",
    sources: ["journal", "self"],
  },
  {
    id: "recovery",
    name: "Recovery & Adaptability",
    weight: 0.05,
    color: "#e879f9",
    description: "Bounce-back after losses, rule updates, continuous improvement.",
    sources: ["journal", "self"],
  },
];

export const GRADE_BANDS = [
  { min: 90, label: "Elite", class: "grade-elite" },
  { min: 75, label: "Proficient", class: "grade-proficient" },
  { min: 60, label: "Developing", class: "grade-developing" },
  { min: 40, label: "At Risk", class: "grade-risk" },
  { min: 0, label: "Critical", class: "grade-critical" },
];

export function gradeForScore(score) {
  return GRADE_BANDS.find((g) => score >= g.min) ?? GRADE_BANDS.at(-1);
}
