export function drawChart(canvas, bars, currentIndex, lookback = 24) {
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  ctx.fillStyle = "#0c0f14";
  ctx.fillRect(0, 0, w, h);

  const start = Math.max(0, currentIndex - lookback + 1);
  const slice = bars.slice(start, currentIndex + 1);
  if (!slice.length) return;

  const highs = slice.map((b) => b.h);
  const lows = slice.map((b) => b.l);
  const max = Math.max(...highs);
  const min = Math.min(...lows);
  const pad = (max - min) * 0.08 || 2;
  const top = max + pad;
  const bot = min - pad;
  const range = top - bot || 1;

  const candleW = Math.max(4, Math.min(14, (w - 40) / slice.length - 2));
  const gap = 2;
  const chartW = slice.length * (candleW + gap);
  const offsetX = Math.max(20, (w - chartW) / 2);

  // grid
  ctx.strokeStyle = "#1a2030";
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const y = 20 + ((h - 40) * i) / 4;
    ctx.beginPath();
    ctx.moveTo(10, y);
    ctx.lineTo(w - 10, y);
    ctx.stroke();
    const price = top - (range * i) / 4;
    ctx.fillStyle = "#4b5563";
    ctx.font = "10px JetBrains Mono, monospace";
    ctx.fillText(price.toFixed(1), 4, y + 3);
  }

  slice.forEach((bar, i) => {
    const x = offsetX + i * (candleW + gap);
    const yOpen = 20 + ((top - bar.o) / range) * (h - 40);
    const yClose = 20 + ((top - bar.c) / range) * (h - 40);
    const yHigh = 20 + ((top - bar.h) / range) * (h - 40);
    const yLow = 20 + ((top - bar.l) / range) * (h - 40);
    const bull = bar.c >= bar.o;
    const color = bull ? "#22c55e" : "#ef4444";

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + candleW / 2, yHigh);
    ctx.lineTo(x + candleW / 2, yLow);
    ctx.stroke();

    const bodyTop = Math.min(yOpen, yClose);
    const bodyH = Math.max(1, Math.abs(yClose - yOpen));
    if (bull) {
      ctx.strokeRect(x, bodyTop, candleW, bodyH);
    } else {
      ctx.fillRect(x, bodyTop, candleW, bodyH);
    }
  });

  // current price line
  const last = slice.at(-1);
  const yLast = 20 + ((top - last.c) / range) * (h - 40);
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = "#38bdf8";
  ctx.beginPath();
  ctx.moveTo(10, yLast);
  ctx.lineTo(w - 10, yLast);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "#38bdf8";
  ctx.font = "11px JetBrains Mono, monospace";
  ctx.fillText(last.c.toFixed(2), w - 72, yLast - 4);
}
