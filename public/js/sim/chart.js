import { emaValues } from "./chart-data.js";
import { formatBarTime } from "./gold-data.js";

function formatTime(ts, tf) {
  if (!ts) return "";
  return formatBarTime(ts, tf);
}

export function drawChart(canvas, bars, options = {}) {
  if (!canvas || !bars?.length) return;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const tf = options.timeframe || "M15";
  const lookback = options.lookback || bars.length;
  const slice = bars.slice(-lookback);
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

  const pad = (max - min) * 0.08 || 2;
  const top = max + pad;
  const bot = min - pad;
  const range = top - bot || 1;

  const yPrice = (p) => padTop + ((top - p) / range) * chartH;

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

  if (options.situationLabel) {
    ctx.fillStyle = "#0a0a0ccc";
    ctx.fillRect(8, 6, Math.min(w - 16, options.situationLabel.length * 7 + 24), 20);
    ctx.fillStyle = "#f5d061";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.fillText(options.situationLabel.toUpperCase(), 14, 20);
  }

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

  const candleW = Math.max(1, Math.min(14, (w - 56) / slice.length - 1));
  const gap = 2;
  const chartW = slice.length * (candleW + gap);
  const offsetX = Math.max(48, w - chartW - 12);

  if (options.markerTs) {
    const markerIdx = slice.findIndex((b) => b.t >= options.markerTs);
    if (markerIdx >= 0) {
      const mx = offsetX + markerIdx * (candleW + gap) + candleW / 2;
      ctx.strokeStyle = "#d4af37";
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(mx, padTop);
      ctx.lineTo(mx, h - padBot);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#f5d061";
      ctx.font = "bold 9px system-ui, sans-serif";
      ctx.fillText((options.sessionLabel || "SESSION").toUpperCase(), mx + 4, padTop + 14);
    }
  }

  const ema = emaValues(slice, Math.min(20, slice.length));
  if (ema.length > 2) {
    ctx.strokeStyle = "#eab30899";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ema.forEach((v, i) => {
      const x = offsetX + i * (candleW + gap) + candleW / 2;
      const y = yPrice(v);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

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

    if (bull) ctx.strokeRect(x, bodyTop, candleW, bodyH);
    else ctx.fillRect(x, bodyTop, candleW, bodyH);

    if (i % Math.max(1, Math.floor(slice.length / 6)) === 0 && bar.t) {
      ctx.fillStyle = "#4b5563";
      ctx.font = "9px JetBrains Mono, ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText(formatTime(bar.t, tf), cx, h - 10);
      ctx.textAlign = "left";
    }
  });

  const last = slice.at(-1);
  const yLast = yPrice(last.c);
  const lastX = offsetX + (slice.length - 1) * (candleW + gap) + candleW / 2;

  // decision point — last candle is where you trade
  ctx.strokeStyle = "#f5d061";
  ctx.setLineDash([4, 3]);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(lastX, padTop);
  ctx.lineTo(lastX, h - padBot);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#f5d061";
  ctx.font = "bold 9px system-ui, sans-serif";
  ctx.fillText("DECISION", lastX - 42, padTop + 12);

  ctx.setLineDash([4, 3]);
  ctx.strokeStyle = "#f5d061";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(48, yLast);
  ctx.lineTo(w - 8, yLast);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "#f5d061";
  ctx.font = "11px JetBrains Mono, ui-monospace, monospace";
  ctx.textAlign = "right";
  ctx.fillText(last.c.toFixed(2), w - 10, yLast - 5);
  ctx.textAlign = "left";

  return { lastBar: last };
}

function updateOhlcHeadline(bar) {
  const head = document.getElementById("chart-ohlc");
  const priceEl = document.getElementById("chart-live-price");
  if (bar && head) {
    head.innerHTML = `<span class="ohlc-item">O <strong>${bar.o.toFixed(2)}</strong></span>
      <span class="ohlc-item">H <strong>${bar.h.toFixed(2)}</strong></span>
      <span class="ohlc-item">L <strong>${bar.l.toFixed(2)}</strong></span>
      <span class="ohlc-item">C <strong class="${bar.c >= bar.o ? "pos" : "neg"}">${bar.c.toFixed(2)}</strong></span>`;
  }
  if (bar && priceEl) priceEl.textContent = bar.c.toFixed(2);
}

/** Static chart — full data visible immediately, no replay animation */
export function createStaticChart(canvas, bars, options = {}) {
  let currentBars = bars;
  let destroyed = false;

  const draw = () => {
    if (destroyed) return;
    const result = drawChart(canvas, currentBars, options);
    updateOhlcHeadline(result?.lastBar);
  };

  function setBars(newBars, tf) {
    currentBars = newBars;
    if (tf) options.timeframe = tf;
    draw();
  }

  function setTimeframe(tf) {
    options.timeframe = tf;
    draw();
  }

  function destroy() {
    destroyed = true;
  }

  const onResize = () => draw();
  window.addEventListener("resize", onResize);

  const api = { draw, setBars, setTimeframe, destroy };
  api._resize = onResize;

  draw();
  return api;
}
