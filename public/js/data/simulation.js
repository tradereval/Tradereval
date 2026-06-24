/**
 * Continuous XAUUSD simulation path.
 * Demo: 3 days fully playable. Structure supports scaling to 30 days.
 * Each bar ≈ 15 minutes. 32 bars per sim day in demo (~8 hours of market).
 */

function genBars(seed) {
  const bars = [];
  let price = 2348.0;
  let s = seed;

  const rand = () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };

  const push = (o, h, l, c) => {
    bars.push({ o, h, l, c, t: bars.length });
    price = c;
  };

  // Day 1 — uptrend with pullback (bars 0–31)
  for (let i = 0; i < 10; i++) push(price, price + 1.2, price - 0.4, price + 0.9);
  for (let i = 0; i < 6; i++) push(price, price + 0.5, price - 1.5, price - 1.1); // pullback
  for (let i = 0; i < 8; i++) push(price, price + 1.8, price - 0.3, price + 1.2); // rally
  for (let i = 0; i < 8; i++) push(price, price + 0.6, price - 0.8, price + (rand() > 0.5 ? 0.3 : -0.2));

  // Day 2 — range / chop (bars 32–63)
  const rangeMid = price;
  for (let i = 0; i < 32; i++) {
    const wave = Math.sin(i / 3) * 4;
    const o = price;
    const c = rangeMid + wave + (rand() - 0.5) * 2;
    const h = Math.max(o, c) + rand() * 1.5;
    const l = Math.min(o, c) - rand() * 1.5;
    push(o, h, l, c);
  }

  // Day 3 — selloff then bounce (bars 64–95)
  for (let i = 0; i < 12; i++) push(price, price + 0.8, price - 2.5, price - 1.8);
  for (let i = 0; i < 8; i++) push(price, price + 1.2, price - 0.6, price + 0.4);
  for (let i = 0; i < 12; i++) push(price, price + 0.5, price - 1.2, price + (i > 8 ? 0.8 : -0.3));

  return bars;
}

export const SIM_CONFIG = {
  symbol: "XAUUSD",
  totalDays: 3,
  fullProgramDays: 30,
  barsPerDay: 32,
  bars: genBars(42),
  days: [
    {
      day: 1,
      phase: "trend",
      title: "Day 1 — Trend & pullback",
      narrative:
        "Gold is bid after Asia. A clean uptrend formed; price pulled back toward prior structure. London overlap adds volume.",
      windows: [
        {
          id: "d1w1",
          barIndex: 14,
          label: "Window 1 — Pullback to support",
          context:
            "Trend is up. Price pulled back ~40% of the move. Session volume picking up.",
          situation: "trend_pullback",
          idealActions: ["long_with_stop", "pass_if_unsure"],
          badActions: ["short", "long_no_stop", "oversize"],
          lookback: 24,
        },
        {
          id: "d1w2",
          barIndex: 22,
          label: "Window 2 — Extended rally",
          context:
            "Price already rallied 18 points from the pullback low. Momentum strong but extended.",
          situation: "fomo_chase",
          idealActions: ["pass", "long_small_with_stop"],
          badActions: ["long_oversize", "long_no_stop", "revenge_if_loss"],
          lookback: 20,
        },
        {
          id: "d1w3",
          barIndex: 28,
          label: "Window 3 — End of session",
          context: "NY afternoon. Spread may widen. You have an open position or flat.",
          situation: "session_end",
          idealActions: ["close_if_unclear", "hold_with_stop"],
          badActions: ["new_impulsive_entry", "remove_stop"],
          lookback: 18,
        },
      ],
    },
    {
      day: 2,
      phase: "range",
      title: "Day 2 — Range & chop",
      narrative:
        "Overnight action balanced. No clear trend — price oscillates between resistance and support. Patience day.",
      windows: [
        {
          id: "d2w1",
          barIndex: 38,
          label: "Window 1 — Range high test",
          context:
            "Price at upper range boundary for the third time. Wicks showing rejection.",
          situation: "range_fade",
          idealActions: ["pass", "short_small_with_stop"],
          badActions: ["long_chase", "long_no_stop", "oversize"],
          lookback: 22,
        },
        {
          id: "d2w2",
          barIndex: 48,
          label: "Window 2 — Mid-range noise",
          context:
            "Middle of the range. No edge — spreads eat R:R. Boredom trap for active traders.",
          situation: "chop_no_edge",
          idealActions: ["pass"],
          badActions: ["any_entry", "overtrade"],
          lookback: 20,
        },
        {
          id: "d2w3",
          barIndex: 58,
          label: "Window 3 — Fake breakout",
          context:
            "Brief spike above range high, quickly rejected back inside. Liquidity grab pattern.",
          situation: "fake_breakout",
          idealActions: ["pass", "short_after_rejection"],
          badActions: ["long_breakout", "long_no_stop"],
          lookback: 22,
        },
      ],
    },
    {
      day: 3,
      phase: "volatility",
      title: "Day 3 — Drawdown & recovery",
      narrative:
        "Sharp selloff hit stops overnight. You're carrying simulated P&L from prior days. Emotions run hot after red.",
      windows: [
        {
          id: "d3w1",
          barIndex: 70,
          label: "Window 1 — After the drop",
          context:
            "You are down on the week. Price still falling. Revenge urge is real — discipline matters now.",
          situation: "post_loss_pressure",
          idealActions: ["pass", "wait", "small_with_stop"],
          badActions: ["oversize", "no_stop", "double_down"],
          lookback: 24,
        },
        {
          id: "d3w2",
          barIndex: 80,
          label: "Window 2 — Stabilization",
          context:
            "Selling slowed. Higher low forming. Still volatile — not a confirmed trend reversal yet.",
          situation: "recovery_setup",
          idealActions: ["long_small_with_stop", "pass"],
          badActions: ["oversize", "short", "no_stop"],
          lookback: 20,
        },
        {
          id: "d3w3",
          barIndex: 90,
          label: "Window 3 — Week close",
          context:
            "Final decision window. Protect capital or press for recovery? Process over outcome.",
          situation: "week_close",
          idealActions: ["close_open_risk", "pass", "small_defined_risk"],
          badActions: ["oversize_recovery", "no_stop", "overtrade"],
          lookback: 18,
        },
      ],
    },
  ],
};

export function getDayConfig(dayNum) {
  return SIM_CONFIG.days.find((d) => d.day === dayNum);
}

export function getTotalWindows() {
  return SIM_CONFIG.days.reduce((n, d) => n + d.windows.length, 0);
}

export function getWindowByGlobalIndex(globalIdx) {
  let i = 0;
  for (const day of SIM_CONFIG.days) {
    for (const w of day.windows) {
      if (i === globalIdx) return { day, window: w };
      i++;
    }
  }
  return null;
}
