import { loadState, saveState, resetEval } from "../store.js";
import { createStaticChart } from "../sim/chart.js";
import { prepareChartMeta, loadChartBars, computeLevels, TIMEFRAMES, tfLabel } from "../sim/chart-data.js";
import { loadReplayLibrary } from "../sim/replay-loader.js";
import { preloadGoldData, contextLabel } from "../sim/gold-data.js";
import { recordAction, generateReport } from "../sim/scoring.js";
import { hasJoinedWishlist, wireWishlistButtons } from "../wishlist.js";
import { isLoggedIn, consumeEvalCredit, loadAuth } from "../auth.js";
import { generateAiSession, evaluateAiSession } from "../ai/client.js";
import {
  getSession,
  getTotalWindows,
  getCurrentWindow,
  sessionMeta,
} from "../ai/session.js";

export async function renderEvaluation(container, { navigate }) {
  if (!isLoggedIn()) {
    navigate("dashboard");
    return;
  }

  const state = loadState();

  if (state.evalComplete) {
    navigate("report");
    return;
  }

  if (!state.aiSession) {
    if (window.__aiLoadActive) {
      container.innerHTML = loadingHtml(state.aiLoadMessage || "AI is building your trading scenarios…");
      return;
    }

    if (!state.evalStarted) {
      state.evalStarted = true;
      saveState(state);
    }
    await loadAiSession(container, loadState(), navigate);
    return;
  }

  if (state.evalLoading) {
    state.evalLoading = false;
    saveState(state);
  }

  const current = getCurrentWindow(state);
  if (!current) {
    await finishEvaluation(state, navigate);
    return;
  }

  const { dayCfg, win, session } = current;
  const meta = sessionMeta(state);
  state.currentDay = dayCfg.day;
  const chartMeta = await prepareChartMeta(win);
  const defaultTf = "M15";
  let bars = await loadChartBars(defaultTf, chartMeta);
  const bar = bars.at(-1) || { o: 0, h: 0, l: 0, c: 0 };
  const levels = computeLevels(bars, bars.length - 1);
  const { situationLabel } = chartMeta;
  const hasPosition = !!state.openPosition;
  const quiz = win.quiz;
  const existingQuiz = state.quizAnswers.find((q) => q.windowId === win.id);
  const quizDone = !quiz || !!existingQuiz;

  container.innerHTML = `
    <div class="eval-layout">
      <aside class="eval-sidebar">
        <div class="day-badge">Day ${state.currentDay} / ${meta.totalDays}</div>
        <span class="ai-badge">${state.aiSession?.source === "ai" ? "AI session" : "Demo session"}</span>
        <h2>${dayCfg.title}</h2>
        <p class="narrative">${dayCfg.narrative}</p>
        <div class="window-meta">
          <span class="pill">${win.label}</span>
          <span class="setup-tag">${situationLabel}</span>
          ${chartMeta.isReal ? `<span class="session-tag">${chartMeta.sessionLabel} · ${chartMeta.replayDate}</span><span class="real-data-tag">Live setup</span>` : ""}
          <p>${win.context}</p>
        </div>
        <ul class="live-stats">
          <li>Sim P&amp;L <strong class="${state.simPnlR >= 0 ? "pos" : "neg"}">${state.simPnlR >= 0 ? "+" : ""}${state.simPnlR.toFixed(1)}R</strong></li>
          <li>Decisions <strong>${state.actionLog.length}</strong></li>
          <li>Position <strong>${hasPosition ? state.openPosition.dir.toUpperCase() : "Flat"}</strong></li>
        </ul>
        <p class="hint">Full day of real price action · switch timeframes · right edge = your entry.</p>
      </aside>

      <section class="eval-main">
        <div class="chart-wrap">
          <div class="chart-toolbar">
            <div class="chart-toolbar-left">
              <span class="chart-symbol">${meta.symbol}</span>
              ${chartMeta.isReal ? `<span class="replay-badge">${chartMeta.sessionLabel} · ${chartMeta.sessionTime} ET</span>` : ""}
              <div class="tf-tabs" id="tf-tabs">
                ${TIMEFRAMES.map((tf) => `<button type="button" class="tf-tab ${tf === defaultTf ? "active" : ""}" data-tf="${tf}">${tfLabel(tf)}</button>`).join("")}
              </div>
            </div>
            <div class="chart-toolbar-right">
              <span id="chart-live-price" class="mono chart-price">${bar.c.toFixed(2)}</span>
            </div>
          </div>
          <div class="chart-ohlc-row" id="chart-ohlc">
            <span class="ohlc-item">O <strong>${bar.o.toFixed(2)}</strong></span>
            <span class="ohlc-item">H <strong>${bar.h.toFixed(2)}</strong></span>
            <span class="ohlc-item">L <strong>${bar.l.toFixed(2)}</strong></span>
            <span class="ohlc-item">C <strong class="${bar.c >= bar.o ? "pos" : "neg"}">${bar.c.toFixed(2)}</strong></span>
          </div>
          <div class="chart-legend">
            <span><i class="leg ema"></i> EMA 20</span>
            <span><i class="leg sup"></i> Support</span>
            <span><i class="leg res"></i> Resistance</span>
            <span><i class="leg open"></i> Session open</span>
          </div>
          <canvas id="price-chart" height="360"></canvas>
          <p class="chart-foot muted" id="chart-status">${chartMeta.isReal ? `Real TVC:GOLD · ${tfLabel(defaultTf)} · ${contextLabel(defaultTf)} · ${chartMeta.replayDate}` : "Multi-timeframe chart — 24h+ context before you trade."}</p>
        </div>

        ${
          quiz
            ? `<div class="quiz-panel card">
            <h3>Judgment check</h3>
            <p>${quiz.question}</p>
            <div class="quiz-options" id="quiz-options">
              ${quiz.options
                .map(
                  (opt, i) =>
                    `<button type="button" class="quiz-opt ${existingQuiz?.chosenIndex === i ? "selected" : ""}" data-quiz="${i}" ${quizDone && existingQuiz?.chosenIndex !== i ? "disabled" : ""}>${opt}</button>`
                )
                .join("")}
            </div>
            ${existingQuiz ? `<p class="muted quiz-feedback">${existingQuiz.chosenIndex === quiz.correctIndex ? "✓ Process-aligned choice." : "Review: " + (quiz.explain || "Consider the context above.")}</p>` : ""}
          </div>`
            : ""
        }

        <div class="action-panel card ${quiz && !quizDone ? "disabled-panel" : ""}" id="action-panel">
          <h3>Your trade decision</h3>
          ${quiz && !quizDone ? `<p class="muted">Answer the judgment check first.</p>` : `<p class="muted" id="trade-hint">Analyze the chart — then enter, pass, or wait.</p>`}
          ${
            hasPosition
              ? `<p class="muted">Open ${state.openPosition.dir} position.</p>
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
                   <button class="btn long" data-act="long" ${quiz && !quizDone ? "disabled" : ""}>Long</button>
                   <button class="btn short" data-act="short" ${quiz && !quizDone ? "disabled" : ""}>Short</button>
                   <button class="btn ghost" data-act="pass" ${quiz && !quizDone ? "disabled" : ""}>Pass — no trade</button>
                 </div>`
          }
        </div>
      </section>
    </div>
  `;

  window.__chartCtrl?.destroy?.();
  if (window.__chartCtrl?._resize) {
    window.removeEventListener("resize", window.__chartCtrl._resize);
  }

  const canvas = container.querySelector("#price-chart");
  const actionPanel = container.querySelector("#action-panel");
  const tradeHint = container.querySelector("#trade-hint");
  const chartStatus = container.querySelector("#chart-status");

  const tradingReady = !(quiz && !quizDone);
  actionPanel?.classList.toggle("disabled-panel", !tradingReady);

  const chartCtrl = createStaticChart(canvas, bars, {
    lookback: bars.length,
    levels,
    situationLabel,
    markerTs: chartMeta.markerTs,
    sessionLabel: chartMeta.sessionLabel,
    timeframe: defaultTf,
  });
  window.__chartCtrl = chartCtrl;

  container.querySelectorAll(".tf-tab").forEach((tab) => {
    tab.addEventListener("click", async () => {
      const tf = tab.dataset.tf;
      container.querySelectorAll(".tf-tab").forEach((t) => t.classList.toggle("active", t === tab));
      tab.disabled = true;
      const tfBars = await loadChartBars(tf, chartMeta);
      tab.disabled = false;
      if (tfBars.length) {
        chartCtrl.setBars(tfBars, tf);
        if (chartStatus) {
          chartStatus.textContent = `Real TVC:GOLD · ${tfLabel(tf)} · ${contextLabel(tf)} · ${chartMeta.replayDate || ""}`;
        }
      }
    });
  });

  const onResize = () => chartCtrl.draw();
  window.addEventListener("resize", onResize);
  chartCtrl._resize = onResize;

  container.querySelectorAll("[data-quiz]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const chosenIndex = Number(btn.dataset.quiz);
      state.quizAnswers.push({
        windowId: win.id,
        day: dayCfg.day,
        question: quiz.question,
        chosenIndex,
        correctIndex: quiz.correctIndex,
        correct: chosenIndex === quiz.correctIndex,
      });
      saveState(state);
      renderEvaluation(container, { navigate });
    });
  });

  container.querySelectorAll("[data-act]").forEach((btn) => {
    btn.addEventListener("click", () => {
      handleAction(btn.dataset.act, { state, dayCfg, win, bar, navigate, container });
    });
  });
}

function handleAction(act, ctx) {
  const { state, dayCfg, win, bar, navigate, container } = ctx;
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
    finishEvaluation(state, navigate);
  } else {
    renderEvaluation(container, { navigate });
  }
}

async function loadAiSession(container, state, navigate) {
  if (window.__aiLoadActive) return;

  window.__aiLoadActive = true;
  state.evalLoading = true;
  state.aiLoadStartedAt = Date.now();
  state.aiLoadMessage = "AI is building your trading scenarios…";
  saveState(state);
  container.innerHTML = loadingHtml(state.aiLoadMessage);

  const subEl = () => container.querySelector("#loading-sub");
  const progressTimer = setInterval(() => {
    const el = subEl();
    if (!el) return;
    const t = el.dataset.tick ? Number(el.dataset.tick) + 1 : 1;
    el.dataset.tick = String(t);
    if (t > 20) el.textContent = "Still working — each day takes ~15–20 seconds…";
    else if (t > 10) el.textContent = "Building your scenarios day by day…";
  }, 3000);

  const setProgress = (msg) => {
    state.aiLoadMessage = msg;
    saveState(state);
    const h2 = container.querySelector(".loading-card h2");
    if (h2) h2.textContent = msg;
  };

  try {
    const sessionPromise = generateAiSession({
      totalDays: 2,
      windowsPerDay: 2,
      experience: state.profile.experience,
      onProgress: (msg) => setProgress(msg),
    });
    const [, , session] = await Promise.all([loadReplayLibrary(), preloadGoldData(), sessionPromise]);
    state.aiSession = session;
    state.aiPowered = true;

    if (!state.evalCreditConsumed) {
      try {
        await consumeEvalCredit();
        state.evalCreditConsumed = true;
      } catch (creditErr) {
        const unlimited = loadAuth()?.user?.unlimitedEvals;
        if (!unlimited) throw creditErr;
        console.warn("Credit consume skipped:", creditErr.message);
        state.evalCreditConsumed = true;
      }
    }
  } catch (err) {
    clearInterval(progressTimer);
    window.__aiLoadActive = false;
    console.warn("AI session failed:", err.message);
    state.aiSession = null;
    state.aiPowered = false;
    state.evalLoading = false;
    state.evalStarted = false;
    saveState(state);
    container.innerHTML = aiErrorHtml(err.message);
    container.querySelector("#ai-retry")?.addEventListener("click", () => {
      state.evalStarted = true;
      saveState(state);
      loadAiSession(container, loadState(), navigate);
    });
    container.querySelector("#ai-back")?.addEventListener("click", () => navigate("dashboard"));
    return;
  }

  clearInterval(progressTimer);
  window.__aiLoadActive = false;
  state.evalLoading = false;
  saveState(state);
  renderEvaluation(container, { navigate });
}

function aiErrorHtml(message) {
  const isTimeout = /timeout|504|too long/i.test(message);
  return `
    <section class="card ai-error-card">
      <h2>AI could not build your session</h2>
      <p class="lead">${message}</p>
      ${isTimeout ? `<p class="muted">The server has a 60-second limit per request. We now build one day at a time — refresh and try again.</p>` : ""}
      <ul class="ai-error-steps">
        <li>Vercel → <strong>tradereval</strong> → Settings → Environment Variables</li>
        <li>Add <code>OPENAI_API_KEY</code> (new key from platform.openai.com)</li>
        <li>Deployments → <strong>Redeploy</strong></li>
        <li>Refresh and try again — your free eval credit is <strong>not used</strong> until AI succeeds</li>
      </ul>
      <div class="btn-row">
        <button class="btn primary" id="ai-retry">Try again</button>
        <button class="btn ghost" id="ai-back">Back to dashboard</button>
      </div>
    </section>
  `;
}

async function finishEvaluation(state, navigate) {
  state.evalComplete = true;
  state.completedDays = sessionMeta(state).totalDays;
  saveState(state);

  const content = document.getElementById("content");
  content.innerHTML = loadingHtml("AI is analyzing your behavior…");

  try {
    const aiReport = await evaluateAiSession({
      actionLog: state.actionLog,
      quizAnswers: state.quizAnswers,
      simPnlR: state.simPnlR,
      session: getSession(state),
    });
    state.report = aiReport;
    state.aiPowered = true;
  } catch (err) {
    console.warn("AI report fallback:", err.message);
    state.report = generateReport(state);
    state.report.aiPowered = false;
    state.report.aiCoaching =
      "Add OPENAI_API_KEY in Vercel to unlock full AI coaching reports.";
  }

  saveState(state);
  navigate("report");
}

function advanceWindow(state) {
  state.currentWindowIdx++;
  const total = getTotalWindows(state);
  if (state.currentWindowIdx >= total) {
    state.evalComplete = true;
    state.completedDays = sessionMeta(state).totalDays;
  } else {
    const cur = getCurrentWindow(state);
    if (cur) state.currentDay = cur.dayCfg.day;
  }
}

function loadingHtml(msg, sub = "Building Day 1, then Day 2 (~40 seconds total).") {
  return `<section class="card loading-card"><div class="loader"></div><h2>${msg}</h2><p class="muted" id="loading-sub">${sub}</p></section>`;
}

export async function renderReport(container, { navigate }) {
  const state = loadState();
  if (!state.report) {
    await finishEvaluation(state, navigate);
    return;
  }
  const r = state.report;
  const meta = sessionMeta(state);
  const joined = hasJoinedWishlist();

  container.innerHTML = `
    <section class="report-hero card">
      <p class="eyebrow">${r.aiPowered ? "AI evaluation complete" : "Evaluation complete"} · ${meta.totalDays}-day session</p>
      <h1>${r.archetype?.name || "Your Trader Profile"}</h1>
      <p class="lead">${r.archetype?.summary || ""}</p>
      <div class="report-scores">
        <div class="score-big">${r.overall}</div>
        <div>
          <p>Overall behavior score</p>
          <p class="muted">Sim P&amp;L: <strong class="${r.simPnlR >= 0 ? "pos" : "neg"}">${r.simPnlR >= 0 ? "+" : ""}${Number(r.simPnlR).toFixed(1)}R</strong></p>
        </div>
      </div>
    </section>

    ${
      r.aiCoaching
        ? `<section class="card ai-coaching-card"><h3>AI coaching report</h3><div class="ai-coaching-text">${formatParagraphs(r.aiCoaching)}</div></section>`
        : ""
    }

    <section class="grid-2">
      <article class="card">
        <h3>Dimension scores</h3>
        <div class="dim-grid">
          ${Object.entries(r.map || {})
            .filter(([k]) => k !== "journaling")
            .map(([k, sc]) => {
              const dim = { psychology: "Psychology", risk: "Risk", strategy: "Strategy", execution: "Execution", market: "Market", consistency: "Consistency", recovery: "Recovery" }[k];
              return `<div class="dim-row"><span>${dim || k}</span><div class="bar-track"><div class="bar-fill" style="width:${sc}%"></div></div><strong>${sc}</strong></div>`;
            })
            .join("")}
        </div>
      </article>

      <article class="card">
        <h3>Behavior &amp; quiz signals</h3>
        <ul class="signal-list">
          <li>Pass rate <strong>${Math.round((r.behavior?.pass_rate || 0) * 100)}%</strong></li>
          <li>Stop usage <strong>${Math.round((r.behavior?.good_stop_rate || 0) * 100)}%</strong></li>
          <li>Quiz accuracy <strong>${r.behavior?.quiz_score != null ? Math.round(r.behavior.quiz_score * 100) + "%" : "—"}</strong></li>
          <li>No-stop entries <strong class="${r.behavior?.no_stop ? "neg" : ""}">${r.behavior?.no_stop ?? 0}</strong></li>
          <li>Oversize entries <strong class="${r.behavior?.oversize ? "neg" : ""}">${r.behavior?.oversize ?? 0}</strong></li>
        </ul>
      </article>
    </section>

    <section class="card">
      <h3>Critical moments</h3>
      ${
        (r.criticalMoments || []).length
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
          : `<p class="muted">No major flags recorded.</p>`
      }
    </section>

    <section class="card fixes-card">
      <h3>Your 3 focus areas</h3>
      <ol class="fix-list">${(r.fixes || []).map((f) => `<li>${f}</li>`).join("")}</ol>
    </section>

    ${
      joined
        ? `<section class="wishlist-banner joined"><div><h3>You're on the waitlist</h3></div></section>`
        : `<section class="wishlist-banner highlight"><div><h3>Want the full 30-day AI program?</h3><p class="muted">Join the free waitlist.</p></div><button class="btn primary" data-open-wishlist="report">Join waitlist</button></section>`
    }

    <section class="card muted-box">
      <div class="btn-row">
        <button class="btn primary" data-action="dashboard">Back to dashboard</button>
        <button class="btn ghost" data-action="restart">New AI evaluation</button>
      </div>
    </section>
  `;

  wireWishlistButtons(container);
  container.querySelector('[data-action="dashboard"]')?.addEventListener("click", () => navigate("dashboard"));
  container.querySelector('[data-action="restart"]')?.addEventListener("click", () => {
    if (confirm("Start a new evaluation? AI will generate fresh scenarios.")) {
      resetEval();
      navigate("dashboard");
    }
  });
}

function formatParagraphs(text) {
  return String(text)
    .split(/\n\n+/)
    .map((p) => `<p>${p.trim()}</p>`)
    .join("");
}
