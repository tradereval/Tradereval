import { SIM_CONFIG, getTotalWindows } from "../data/simulation.js";
import { loadState, saveState, resetEval } from "../store.js";
import { drawChart } from "../sim/chart.js";
import { recordAction, generateReport } from "../sim/scoring.js";
import { hasJoinedWishlist, wireWishlistButtons } from "../wishlist.js";

export function renderEvaluation(container, { navigate }) {
  const state = loadState();
  if (!state.evalStarted) {
    state.evalStarted = true;
    saveState(state);
  }

  if (state.evalComplete) {
    navigate("report");
    return;
  }

  const current = getCurrentWindow(state);
  if (!current) {
    state.evalComplete = true;
    state.report = generateReport(state);
    saveState(state);
    navigate("report");
    return;
  }

  const { dayCfg, win } = current;
  state.currentDay = dayCfg.day;
  const bar = SIM_CONFIG.bars[win.barIndex];
  const hasPosition = !!state.openPosition;

  container.innerHTML = `
    <div class="eval-layout">
      <aside class="eval-sidebar">
        <div class="day-badge">Day ${state.currentDay} / ${SIM_CONFIG.totalDays}</div>
        <h2>${dayCfg.title}</h2>
        <p class="narrative">${dayCfg.narrative}</p>
        <div class="window-meta">
          <span class="pill">${win.label}</span>
          <p>${win.context}</p>
        </div>
        <ul class="live-stats">
          <li>Sim P&amp;L <strong class="${state.simPnlR >= 0 ? "pos" : "neg"}">${state.simPnlR >= 0 ? "+" : ""}${state.simPnlR.toFixed(1)}R</strong></li>
          <li>Decisions <strong>${state.actionLog.length}</strong></li>
          <li>Position <strong>${hasPosition ? state.openPosition.dir.toUpperCase() : "Flat"}</strong></li>
        </ul>
        <p class="hint">We evaluate what you <em>do</em> — pass, enter, size, and stop placement all count.</p>
      </aside>

      <section class="eval-main">
        <div class="chart-wrap">
          <div class="chart-head">
            <span>${SIM_CONFIG.symbol}</span>
            <span class="mono">${bar.c.toFixed(2)}</span>
          </div>
          <canvas id="price-chart" height="320"></canvas>
        </div>

        <div class="action-panel card">
          <h3>Your decision</h3>
          ${
            hasPosition
              ? `<p class="muted">You have an open ${state.openPosition.dir}. Manage or hold.</p>
                 <div class="btn-row">
                   <button class="btn primary" data-act="close">Close position</button>
                   <button class="btn ghost" data-act="hold">Hold</button>
                 </div>`
              : `<div class="form-row">
                   <label>Risk per trade</label>
                   <select id="risk-pct">
                     <option value="0.5">0.5%</option>
                     <option value="1" selected>1%</option>
                     <option value="2">2%</option>
                     <option value="5">5% (aggressive)</option>
                   </select>
                 </div>
                 <div class="form-row checkbox-row">
                   <label><input type="checkbox" id="has-stop" checked /> Stop loss placed before entry</label>
                 </div>
                 <div class="btn-row">
                   <button class="btn long" data-act="long">Long</button>
                   <button class="btn short" data-act="short">Short</button>
                   <button class="btn ghost" data-act="pass">Pass — no trade</button>
                 </div>`
          }
        </div>
      </section>
    </div>
  `;

  const canvas = container.querySelector("#price-chart");
  requestAnimationFrame(() => drawChart(canvas, SIM_CONFIG.bars, win.barIndex, win.lookback));

  container.querySelectorAll("[data-act]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const act = btn.dataset.act;
      handleAction(act, { state, dayCfg, win, bar, navigate, container });
    });
  });
}

function handleAction(act, ctx) {
  const { state, dayCfg, win, bar, navigate } = ctx;
  const riskPct = parseFloat(document.getElementById("risk-pct")?.value || "1");
  const hasStop = document.getElementById("has-stop")?.checked ?? true;

  const payload = {
    day: state.currentDay,
    windowId: win.id,
    windowLabel: win.label,
    windowMeta: win,
    action: act,
    price: bar.c,
    riskPct: act === "long" || act === "short" ? riskPct : 0,
    hasStop: act === "long" || act === "short" ? hasStop : state.openPosition?.hasStop,
  };

  recordAction(state, payload);
  advanceWindow(state);
  saveState(state);

  if (state.evalComplete) {
    state.report = generateReport(state);
    saveState(state);
    navigate("report");
  } else {
    renderEvaluation(document.getElementById("content"), { navigate });
  }
}

function getCurrentWindow(state) {
  let count = 0;
  for (const dayCfg of SIM_CONFIG.days) {
    for (const win of dayCfg.windows) {
      if (count === state.currentWindowIdx) return { dayCfg, win };
      count++;
    }
  }
  return null;
}

function advanceWindow(state) {
  state.currentWindowIdx++;
  const total = getTotalWindows();
  if (state.currentWindowIdx >= total) {
    state.evalComplete = true;
    state.completedDays = SIM_CONFIG.totalDays;
  } else {
    const cur = getCurrentWindow(state);
    if (cur) state.currentDay = cur.dayCfg.day;
  }
}

export async function renderReport(container, { navigate }) {
  const state = loadState();
  if (!state.report) {
    state.report = generateReport(state);
    saveState(state);
  }
  const r = state.report;
  const joined = hasJoinedWishlist();

  container.innerHTML = `
    <section class="report-hero card">
      <p class="eyebrow">Evaluation complete · ${SIM_CONFIG.totalDays}-day demo</p>
      <h1>${r.archetype.name}</h1>
      <p class="lead">${r.archetype.summary}</p>
      <div class="report-scores">
        <div class="score-big">${r.overall}</div>
        <div>
          <p>Overall behavior score</p>
          <p class="muted">Sim P&amp;L: <strong class="${r.simPnlR >= 0 ? "pos" : "neg"}">${r.simPnlR >= 0 ? "+" : ""}${r.simPnlR.toFixed(1)}R</strong> — score weights process over outcome</p>
        </div>
      </div>
    </section>

    <section class="grid-2">
      <article class="card">
        <h3>Dimension scores</h3>
        <div class="dim-grid">
          ${Object.entries(r.map)
            .filter(([k]) => k !== "journaling")
            .map(([k, sc]) => {
              const dim = { psychology: "Psychology", risk: "Risk", strategy: "Strategy", execution: "Execution", market: "Market", consistency: "Consistency", recovery: "Recovery" }[k];
              return `<div class="dim-row"><span>${dim}</span><div class="bar-track"><div class="bar-fill" style="width:${sc}%"></div></div><strong>${sc}</strong></div>`;
            })
            .join("")}
        </div>
      </article>

      <article class="card">
        <h3>Behavior signals</h3>
        <ul class="signal-list">
          <li>Pass rate <strong>${Math.round(r.behavior.pass_rate * 100)}%</strong></li>
          <li>Stop usage <strong>${Math.round(r.behavior.good_stop_rate * 100)}%</strong></li>
          <li>No-stop entries <strong class="${r.behavior.no_stop ? "neg" : ""}">${r.behavior.no_stop}</strong></li>
          <li>Oversize entries <strong class="${r.behavior.oversize ? "neg" : ""}">${r.behavior.oversize}</strong></li>
          <li>Chase / FOMO entries <strong>${r.behavior.chase_entries}</strong></li>
          <li>Chop trades <strong>${r.behavior.chop_entries}</strong></li>
          <li>Size-after-loss events <strong class="${r.behavior.size_after_loss ? "neg" : ""}">${r.behavior.size_after_loss}</strong></li>
        </ul>
      </article>
    </section>

    <section class="card">
      <h3>Critical moments</h3>
      ${
        r.criticalMoments.length
          ? `<div class="timeline">${r.criticalMoments
              .map(
                (m) => `<div class="tl-item">
              <span class="tl-day">Day ${m.day}</span>
              <strong>${m.label}</strong>
              <p class="mono">${m.action}</p>
              <p class="muted">${m.note}</p>
            </div>`
              )
              .join("")}</div>`
          : `<p class="muted">No major flags — solid session.</p>`
      }
    </section>

    <section class="card fixes-card">
      <h3>Your 3 focus areas this month</h3>
      <ol class="fix-list">${r.fixes.map((f) => `<li>${f}</li>`).join("")}</ol>
    </section>

    ${
      joined
        ? `<section class="wishlist-banner joined">
            <div>
              <h3>Thanks — you're on the launch waitlist</h3>
              <p class="muted">We'll notify you when the full 30-day eval and AI coaching go live.</p>
            </div>
          </section>`
        : `<section class="wishlist-banner highlight">
            <div>
              <h3>Want the full product when we launch?</h3>
              <p class="muted">Join the free waitlist — no Stripe, no payment. We use interest to decide when to launch publicly.</p>
            </div>
            <button class="btn primary" data-open-wishlist="report">Join waitlist</button>
          </section>`
    }

    <section class="card muted-box">
      <h3>What's next</h3>
      <p>Full <strong>30-day</strong> program and AI coaching reports are in development. Stripe for paid re-evaluations comes <em>after</em> launch — only if traders want it.</p>
      <div class="btn-row">
        <button class="btn primary" data-action="dashboard">Back to dashboard</button>
        <button class="btn ghost" data-action="restart">Retake evaluation</button>
      </div>
    </section>
  `;

  wireWishlistButtons(container);
  container.querySelector('[data-action="dashboard"]')?.addEventListener("click", () => navigate("dashboard"));
  container.querySelector('[data-action="restart"]')?.addEventListener("click", () => {
    if (confirm("Start a new evaluation?")) {
      resetEval();
      navigate("dashboard");
    }
  });
}
