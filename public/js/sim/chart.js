import { aggregateBars, emaValues } from "./chart-data.js";

function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function drawChart(canvas, bars, visibleCount, options = {}) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const tf = options.timeframe || "M15";
  const revealed = bars.slice(0, Math.min(visibleCount, bars.length));
  const aggregated = aggregateBars(revealed, tf);
  const lookback = options.lookback || 36;
  const slice = aggregated.slice(-lookback);
  if (!slice.length) return;

  const padTop = 28;
  const padBot = 36;
  const chartH = h - padTop - padBot;

  ctx.fillStyle = "#0a0d12";
  ctx.fillRect(0, 0, w, h);

  const highs = slice.map((b) => b.h);
  const lows = slice.map((b) => b.l);
  let max = Math.max(...highs);
  let min = Math.min(...lows);

  const levels = options.levels || {};
  [levels.resistance, levels.support, levels.sessionOpen].forEach((p) => {
    if (p != null) {
      max = Math.max(max, p);
      min = Math.min(min, p);
    }
  });

  const pad = (max - min) * 0.1 || 2;
  const top = max + pad;
  const bot = min - pad;
  const range = top - bot || 1;

  const yPrice = (p) => padTop + ((top - p) / range) * chartH;

  // grid + price labels (right)
  ctx.strokeStyle = "#1a2233";
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const y = padTop + (chartH * i) / 4;
    ctx.beginPath();
    ctx.moveTo(48, y);
    ctx.lineTo(w - 8, y);
    ctx.stroke();
    const price = top - (range * i) / 4;
    ctx.fillStyle = "#5c6b80";
    ctx.font = "10px JetBrains Mono, ui-monospace, monospace";
    ctx.textAlign = "right";
    ctx.fillText(price.toFixed(1), w - 10, y + 3);
  }
  ctx.textAlign = "left";

  // setup type banner
  if (options.situationLabel) {
    ctx.fillStyle = "#0f172a99";
    ctx.fillRect(8, 6, Math.min(w - 16, options.situationLabel.length * 7 + 24), 20);
    ctx.fillStyle = "#86efac";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.fillText(options.situationLabel.toUpperCase(), 14, 20);
  }

  // key levels
  const drawLevel = (price, color, label) => {
    if (price == null) return;
    const y = yPrice(price);
    ctx.strokeStyle = color;
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(48, y);
    ctx.lineTo(w - 8, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = color;
    ctx.font = "9px JetBrains Mono, ui-monospace, monospace";
    ctx.fillText(label, 52, y - 3);
  };
  drawLevel(levels.resistance, "#f59e0b88", "Res");
  drawLevel(levels.support, "#38bdf888", "Sup");
  drawLevel(levels.sessionOpen, "#a78bfa66", "Open");

  const candleW = Math.max(5, Math.min(16, (w - 56) / slice.length - 3));
  const gap = 2;
  const chartW = slice.length * (candleW + gap);
  const offsetX = Math.max(48, w - chartW - 12);

  // session open marker (NY / London open vertical line)
  if (options.isReplay && options.markerBar != null) {
    const fullLen = aggregated.length;
    const sliceStart = fullLen - slice.length;
    const markerInSlice = options.markerBar - sliceStart;
    if (markerInSlice >= 0 && markerInSlice < slice.length) {
      const mx = offsetX + markerInSlice * (candleW + gap) + candleW / 2;
      ctx.strokeStyle = "#c4b5fd";
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(mx, padTop);
      ctx.lineTo(mx, h - padBot);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#c4b5fd";
      ctx.font = "bold 9px system-ui, sans-serif";
      ctx.fillText((options.sessionLabel || "SESSION").toUpperCase(), mx + 4, padTop + 14);
    }
  }

  // EMA
  const ema = emaValues(aggregated, Math.min(20, aggregated.length));
  const emaSlice = ema.slice(-slice.length);
  if (emaSlice.length > 2) {
    ctx.strokeStyle = "#eab30899";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    emaSlice.forEach((v, i) => {
      const x = offsetX + i * (candleW + gap) + candleW / 2;
      const y = yPrice(v);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  // candles
  slice.forEach((bar, i) => {
    const x = offsetX + i * (candleW + gap);
    const cx = x + candleW / 2;
    const bull = bar.c >= bar.o;
    const color = bull ? "#22c55e" : "#ef4444";
    const yHigh = yPrice(bar.h);
    const yLow = yPrice(bar.l);
    const yOpen = yPrice(bar.o);
    const yClose = yPrice(bar.c);

    ctx.strokeStyle = color;
    ctx.fillStyle = bull ? "#0a0d12" : color;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx, yHigh);
    ctx.lineTo(cx, yLow);
    ctx.stroke();

    const bodyTop = Math.min(yOpen, yClose);
    let bodyH = Math.abs(yClose - yOpen);
    if (bodyH < 1.5) bodyH = 1.5;

    if (bull) {
      ctx.strokeRect(x, bodyTop, candleW, bodyH);
    } else {
      ctx.fillRect(x, bodyTop, candleW, bodyH);
    }

    // time labels every few bars
    if (i % Math.max(1, Math.floor(slice.length / 5)) === 0 && bar.t) {
      ctx.fillStyle = "#4b5563";
      ctx.font = "9px JetBrains Mono, ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText(formatTime(bar.t), cx, h - 10);
      ctx.textAlign = "left";
    }
  });

  // current price line + tag
  const last = slice.at(-1);
  const yLast = yPrice(last.c);
  ctx.setLineDash([4, 3]);
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(48, yLast);
  ctx.lineTo(w - 8, yLast);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "#38bdf8";
  ctx.font = "11px JetBrains Mono, ui-monospace, monospace";
  ctx.textAlign = "right";
  ctx.fillText(last.c.toFixed(2), w - 10, yLast - 5);
  ctx.textAlign = "left";

  // forming candle pulse on last bar
  if (options.pulseLast) {
    const lx = offsetX + (slice.length - 1) * (candleW + gap) + candleW / 2;
    ctx.strokeStyle = "#38bdf866";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(lx, yLast, 6 + options.pulseLast * 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  return { lastBar: last, offsetX, candleW, gap, sliceLen: slice.length };
}

/**
 * Reveal candles one-by-one like a live feed, then call onReady.
 */
export function createLiveChart(canvas, bars, options = {}) {
  const animateCount = options.animateBars ?? 14;
  let visibleCount = Math.max(8, bars.length - animateCount);
  let destroyed = false;
  let animFrame = null;
  let pulse = 0;
  let playing = false;

  const draw = () => {
    if (destroyed) return;
    drawChart(canvas, bars, visibleCount, {
      ...options,
      pulseLast: visibleCount < bars.length ? pulse : 0,
    });
    const head = document.getElementById("chart-ohlc");
    const priceEl = document.getElementById("chart-live-price");
    const revealed = bars.slice(0, Math.min(visibleCount, bars.length));
    const agg = aggregateBars(revealed, options.timeframe || "M15");
    const bar = agg.at(-1);
    if (bar && head) {
      head.innerHTML = `<span class="ohlc-item">O <strong>${bar.o.toFixed(2)}</strong></span>
        <span class="ohlc-item">H <strong>${bar.h.toFixed(2)}</strong></span>
        <span class="ohlc-item">L <strong>${bar.l.toFixed(2)}</strong></span>
        <span class="ohlc-item">C <strong class="${bar.c >= bar.o ? "pos" : "neg"}">${bar.c.toFixed(2)}</strong></span>`;
    }
    if (bar && priceEl) priceEl.textContent = bar.c.toFixed(2);
  };

  const tickPulse = () => {
    if (destroyed) return;
    pulse = (pulse + 0.06) % 1;
    if (playing && visibleCount < bars.length) {
      animFrame = requestAnimationFrame(tickPulse);
      draw();
    } else if (!playing) {
      draw();
    }
  };

  async function playReveal() {
    if (playing) return;
    playing = true;
    options.onPlayStart?.();
    tickPulse();

    const target = bars.length;
    const ms = options.candleMs ?? 220;

    while (!destroyed && visibleCount < target) {
      await sleep(ms);
      visibleCount++;
      draw();
    }

    playing = false;
    if (!destroyed) options.onReady?.();
  }

  function skipToEnd() {
    visibleCount = bars.length;
    playing = false;
    draw();
    options.onReady?.();
  }

  function setTimeframe(tf) {
    options.timeframe = tf;
    draw();
  }

  function destroy() {
    destroyed = true;
    if (animFrame) cancelAnimationFrame(animFrame);
  }

  const api = { playReveal, skipToEnd, setTimeframe, destroy, draw };
  api._resize = null;

  draw();
  return api;
}
