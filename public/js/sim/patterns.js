/** Procedural XAUUSD patterns — each situation type looks visually different */

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0 || 42;
}

function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function bar(o, c, rand, wick = 0.8) {
  const body = Math.abs(c - o);
  const w = Math.max(0.3, wick * (0.6 + rand() * 0.8));
  const h = +(Math.max(o, c) + w + body * 0.1).toFixed(2);
  const l = +(Math.min(o, c) - w - body * 0.05).toFixed(2);
  return { o: +o.toFixed(2), c: +c.toFixed(2), h, l };
}

function trend(n, start, step, rand, bullish = true) {
  const out = [];
  let p = start;
  for (let i = 0; i < n; i++) {
    const o = p;
    const move = (bullish ? 1 : -1) * (step * (0.6 + rand() * 0.8));
    const c = o + move;
    out.push(bar(o, c, rand, 0.5 + rand() * 0.6));
    p = c;
  }
  return { bars: out, price: p };
}

function chop(n, mid, amp, rand) {
  const out = [];
  let p = mid;
  for (let i = 0; i < n; i++) {
    const o = p;
    const wave = Math.sin(i / 2.2) * amp;
    const c = mid + wave + (rand() - 0.5) * amp * 0.4;
    out.push(bar(o, c, rand, 0.4 + rand() * 0.3));
    p = c;
  }
  return { bars: out, price: p };
}

const PATTERN_BUILDERS = {
  trend_pullback(seed, start) {
    const rand = rng(seed);
    const a = trend(22, start, 1.1, rand, true);
    const b = trend(14, a.price, -1.0, rand, false);
    const c = chop(12, b.price, 1.2, rand);
    return [...a.bars, ...b.bars, ...c.bars];
  },

  fomo_chase(seed, start) {
    const rand = rng(seed);
    const a = trend(18, start, 0.7, rand, true);
    const out = [...a.bars];
    let p = a.price;
    for (let i = 0; i < 12; i++) {
      const o = p;
      const c = o + 1.8 + rand() * 1.5;
      out.push(bar(o, c, rand, 0.3));
      p = c;
    }
    const d = chop(8, p, 0.8, rand);
    return [...out, ...d.bars];
  },

  chop_no_edge(seed, start) {
    const rand = rng(seed);
    return chop(42, start, 2.5, rand).bars;
  },

  range_fade(seed, start) {
    const rand = rng(seed);
    const mid = start;
    const out = [];
    let p = mid;
    for (let i = 0; i < 42; i++) {
      const o = p;
      const touchHigh = i % 9 === 0;
      const touchLow = i % 11 === 0;
      let c = mid + (rand() - 0.5) * 3;
      if (touchHigh) c = mid + 3.5 + rand();
      if (touchLow) c = mid - 3.5 - rand();
      const b = bar(o, c, rand, touchHigh || touchLow ? 1.4 : 0.5);
      if (touchHigh) b.h = mid + 5 + rand() * 0.8;
      if (touchLow) b.l = mid - 5 - rand() * 0.8;
      out.push(b);
      p = c;
    }
    return out;
  },

  fake_breakout(seed, start) {
    const rand = rng(seed);
    const base = chop(20, start, 2, rand);
    const out = [...base.bars];
    let p = base.price;
    for (let i = 0; i < 4; i++) {
      const o = p;
      const c = o + 2.5;
      const b = bar(o, c, rand, 0.4);
      b.h = c + 1.2;
      out.push(b);
      p = c;
    }
    const trap = trend(8, p, -1.6, rand, false);
    const rest = chop(10, trap.price, 1.5, rand);
    return [...out, ...trap.bars, ...rest.bars];
  },

  post_loss_pressure(seed, start) {
    const rand = rng(seed);
    const out = [];
    let p = start;
    for (let i = 0; i < 42; i++) {
      const o = p;
      const dir = i % 2 === 0 ? -1 : 1;
      const c = o + dir * (1.5 + rand() * 2);
      out.push(bar(o, c, rand, 1 + rand()));
      p = c;
    }
    return out;
  },

  recovery_setup(seed, start) {
    const rand = rng(seed);
    const drop = trend(16, start, -1.4, rand, false);
    const base = chop(10, drop.price, 0.9, rand);
    const bounce = trend(16, base.price, 1.0, rand, true);
    return [...drop.bars, ...base.bars, ...bounce.bars];
  },

  session_end(seed, start) {
    const rand = rng(seed);
    const out = [];
    let p = start;
    for (let i = 0; i < 18; i++) {
      const o = p;
      const c = o + (rand() - 0.5) * 1.2;
      out.push(bar(o, c, rand, 0.35));
      p = c;
    }
    const tight = chop(24, p, 0.6, rand);
    return [...out, ...tight.bars];
  },
};

export function generatePattern(situation, seedKey, basePrice = 2365) {
  const seed = hashSeed(`${situation}-${seedKey}`);
  const builder = PATTERN_BUILDERS[situation] || PATTERN_BUILDERS.trend_pullback;
  const start = basePrice + (seed % 12) - 6;
  return builder(seed, start);
}

export function basePriceForWindow(win, day, sessionSeed = 0) {
  const h = hashSeed(`${sessionSeed}-${day}-${win?.id || "w"}`);
  return 2358 + (day - 1) * 4 + (h % 18);
}
