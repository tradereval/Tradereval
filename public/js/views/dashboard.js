import { DIMENSIONS, gradeForScore } from "../data/dimensions.js";
import { SIM_CONFIG } from "../data/simulation.js";
import { loadState, saveState, resetEval } from "../store.js";
import { wishlistBannerHtml, wireWishlistButtons } from "../wishlist.js";
import { getTotalWindows } from "../ai/session.js";

export async function renderDashboard(container, { navigate }, waitlistCount = null) {
  const state = loadState();
  const totalWindows = getTotalWindows(state) || 9;
  const progress = state.evalComplete
    ? 100
    : Math.round((state.currentWindowIdx / totalWindows) * 100);

  container.innerHTML = `
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">AI-powered · No funding · No prop firm</p>
        <h1>Trade the simulation.<br/>AI builds every scenario.</h1>
        <p class="lead">
          <strong>AI generates</strong> your trades, quiz questions, and coaching report — nothing to update manually.
          Each run is a new ${SIM_CONFIG.totalDays}-day XAUUSD story. You click; AI evaluates behavior.
        </p>
        <div class="hero-actions">
          ${
            state.evalComplete
              ? `<button class="btn primary" data-action="report">View your report</button>
                 <button class="btn ghost" data-action="restart">Start fresh evaluation</button>`
              : state.evalStarted
                ? `<button class="btn primary" data-action="continue">Continue Day ${state.currentDay}</button>
                   <button class="btn ghost" data-action="restart">Reset</button>`
                : `<button class="btn primary" data-action="start">Start free evaluation</button>`
          }
        </div>
      </div>
      <div class="hero-card">
        <h3>Your progress</h3>
        <div class="progress-ring-wrap">
          <svg viewBox="0 0 120 120" class="progress-ring">
            <circle cx="60" cy="60" r="52" class="ring-bg"/>
            <circle cx="60" cy="60" r="52" class="ring-fill" style="stroke-dashoffset: ${326 - (326 * progress) / 100}"/>
          </svg>
          <div class="progress-label">${progress}%</div>
        </div>
        <ul class="stat-list">
          <li><span>Program</span><strong>${SIM_CONFIG.totalDays} / ${SIM_CONFIG.fullProgramDays} days (demo)</strong></li>
          <li><span>Decisions logged</span><strong>${state.actionLog.length}</strong></li>
          <li><span>Sim P&amp;L</span><strong class="${state.simPnlR >= 0 ? "pos" : "neg"}">${state.simPnlR >= 0 ? "+" : ""}${state.simPnlR.toFixed(1)}R</strong></li>
          <li><span>Launch</span><strong class="muted">Waitlist open · Stripe later</strong></li>
        </ul>
      </div>
    </section>

    ${wishlistBannerHtml(waitlistCount)}

    <section class="grid-3">
      <article class="card">
        <h3>AI-generated</h3>
        <p>New scenarios, Q&amp;A, and reports every time — you never edit content by hand.</p>
      </article>
      <article class="card">
        <h3>Continuous price</h3>
        <p>One XAUUSD story across the month. Context from Day 5 still matters on Day 22.</p>
      </article>
      <article class="card">
        <h3>Trader identity report</h3>
        <p>Archetype, weak moments, dimension scores, and 3 fixes for the next 30 days.</p>
      </article>
    </section>

    <section class="card setup-note">
      <h3>Before we launch publicly</h3>
      <p>Join the waitlist if you want the full 30-day product. We use signups to measure interest before adding Stripe and your domain. No payment required now.</p>
    </section>
  `;

  wireWishlistButtons(container);
  container.querySelector('[data-action="start"]')?.addEventListener("click", () => {
    resetEval();
    const s = loadState();
    s.evalStarted = true;
    s.profile.startedAt = new Date().toISOString();
    saveState(s);
    navigate("evaluation");
  });

  container.querySelector('[data-action="continue"]')?.addEventListener("click", () => navigate("evaluation"));
  container.querySelector('[data-action="report"]')?.addEventListener("click", () => navigate("report"));
  container.querySelector('[data-action="restart"]')?.addEventListener("click", () => {
    if (confirm("Reset your evaluation progress?")) {
      resetEval();
      navigate("dashboard");
    }
  });
}

export function renderProfile(container) {
  const state = loadState();
  const report = state.report;
  const overall = report?.overall ?? "—";
  const grade = report ? gradeForScore(report.overall) : null;

  container.innerHTML = `
    <section class="card">
      <h2>Trader Profile</h2>
      <p class="muted">Built from your actions in the simulation — not from quiz answers.</p>
      ${
        report
          ? `<div class="profile-header">
              <div class="score-big">${overall}</div>
              <div>
                <span class="grade-pill ${grade.class}">${grade.label}</span>
                <h3>${report.archetype.name}</h3>
                <p>${report.archetype.summary}</p>
              </div>
            </div>
            <div class="dim-grid">
              ${DIMENSIONS.filter((d) => d.id !== "journaling" || report.map.journaling > 0)
                .map((d) => {
                  const sc = report.map[d.id] ?? "—";
                  return `<div class="dim-row"><span>${d.name}</span><div class="bar-track"><div class="bar-fill" style="width:${sc}%;background:${d.color}"></div></div><strong>${sc}</strong></div>`;
                })
                .join("")}
            </div>`
          : `<p class="empty">Complete the evaluation to unlock your profile.</p>
             <button class="btn primary" id="go-eval">Start evaluation</button>`
      }
    </section>
  `;

  container.querySelector("#go-eval")?.addEventListener("click", () => {
    window.__navigate("evaluation");
  });
}
