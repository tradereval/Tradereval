import { DIMENSIONS, gradeForScore } from "../data/dimensions.js";
import { SIM_CONFIG } from "../data/simulation.js";
import { loadState, saveState, resetEval } from "../store.js";
import { wishlistBannerHtml, wireWishlistButtons } from "../wishlist.js";
import { getTotalWindows } from "../ai/session.js";
import {
  loadAuth,
  isLoggedIn,
  openAuthModal,
  refreshUser,
} from "../auth.js";
import { fetchAiStatus } from "../ai/client.js";

export async function renderDashboard(container, { navigate }, waitlistCount = null) {
  const state = loadState();
  const auth = loadAuth();
  if (isLoggedIn()) await refreshUser();
  const user = loadAuth()?.user;
  const aiStatus = await fetchAiStatus();
  const totalWindows = getTotalWindows(state) || 6;
  const progress = state.evalComplete
    ? 100
    : Math.round((state.currentWindowIdx / totalWindows) * 100);
  const unlimited = user?.unlimitedEvals === true || aiStatus.unlimitedEvals === true;
  const credits = unlimited ? "∞" : (user?.evalCredits ?? 0);
  const canEvaluate = unlimited || (user?.evalCredits ?? 0) > 0;

  container.innerHTML = `
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">◆ White-glove trader training</p>
        <h1>Real gold.<br/>Real edge.<br/>Lambo discipline.</h1>
        <p class="lead">
          <strong>Real TradingView gold data</strong> — NY Open, London, overlap sessions.
          Switch <strong>1m · 5m · 15m · 1h · 4h · 1d</strong> on the same setup.
          AI shuffles historical days and grades your process, not hindsight.
        </p>
        ${
          !isLoggedIn()
            ? `<p class="signup-note">Sign up required · <strong>${unlimited ? "unlimited evaluations while testing" : "1 free AI evaluation per email"}</strong></p>`
            : `<p class="signup-note">Signed in as <strong>${user.email}</strong> · Evals: <strong>${credits}</strong>${unlimited ? " <span class='testing-pill'>testing</span>" : ""}</p>`
        }
        <div class="hero-actions">
          ${
            !isLoggedIn()
              ? `<button class="btn primary" data-action="signup">Sign up free — get 1 eval</button>
                 <button class="btn ghost" data-action="login">Sign in</button>`
              : state.evalComplete
                ? `<button class="btn primary" data-action="report">View your report</button>
                   <button class="btn ghost" data-action="start">${unlimited ? "Start new evaluation" : canEvaluate ? "Use another free eval" : ""}</button>
                   ${!unlimited && !canEvaluate ? `<button class="btn ghost" data-open-wishlist="dashboard">Join waitlist for more</button>` : ""}`
                : state.evalStarted
                  ? `<button class="btn primary" data-action="continue">Continue Day ${state.currentDay}</button>`
                  : canEvaluate
                    ? `<button class="btn primary" data-action="start">${unlimited ? "Start evaluation" : "Start your free evaluation"}</button>`
                    : `<button class="btn primary" data-open-wishlist="dashboard">No evals left — join waitlist</button>`
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
          <li><span>Account</span><strong>${isLoggedIn() ? "Active" : "Sign up required"}</strong></li>
          <li><span>Evals available</span><strong>${isLoggedIn() ? credits : unlimited ? "∞" : "1 on signup"}</strong></li>
          <li><span>Decisions logged</span><strong>${state.actionLog.length}</strong></li>
          <li><span>Sim P&amp;L</span><strong class="${state.simPnlR >= 0 ? "pos" : "neg"}">${state.simPnlR >= 0 ? "+" : ""}${state.simPnlR.toFixed(1)}R</strong></li>
        </ul>
      </div>
    </section>

    ${
      unlimited
        ? `<section class="ai-status-banner connected"><span class="ai-dot"></span> <strong>Testing mode:</strong> unlimited evaluations — sign up only</section>`
        : ""
    }
    ${
      aiStatus.configured
        ? `<section class="ai-status-banner connected"><span class="ai-dot"></span> AI engine connected · scenarios &amp; reports powered by OpenAI (${aiStatus.model || "gpt-4o-mini"})</section>`
        : `<section class="ai-status-banner offline"><span class="ai-dot"></span> <strong>AI not connected.</strong> Add <code>OPENAI_API_KEY</code> in Vercel → redeploy. Evaluations will not start until AI is live.</section>`
    }

    ${wishlistBannerHtml(waitlistCount)}

    <section class="grid-3">
      <article class="card highlight-card">
        <h3>Real XAUUSD data</h3>
        <p>TradingView gold OHLC — NY Open, London, overlap. Not fake candles or random AI bars.</p>
      </article>
      <article class="card highlight-card">
        <h3>6 timeframes</h3>
        <p>1m · 5m · 15m · 1h · 4h · 1d — each with <strong>24h+ of real history</strong> before your decision.</p>
      </article>
      <article class="card highlight-card">
        <h3>AI picks the day</h3>
        <p>Shuffled historical sessions + behavior report. Know your leaks before you risk capital.</p>
      </article>
    </section>
  `;

  wireWishlistButtons(container);

  container.querySelector('[data-action="signup"]')?.addEventListener("click", () => {
    openAuthModal("signup", () => navigate("dashboard"));
  });
  container.querySelector('[data-action="login"]')?.addEventListener("click", () => {
    openAuthModal("login", () => navigate("dashboard"));
  });
  container.querySelector('[data-action="start"]')?.addEventListener("click", () =>
    startEvaluation(navigate)
  );
  container.querySelector('[data-action="continue"]')?.addEventListener("click", () =>
    navigate("evaluation")
  );
  container.querySelector('[data-action="report"]')?.addEventListener("click", () =>
    navigate("report")
  );
}

export async function startEvaluation(navigate) {
  if (!isLoggedIn()) {
    openAuthModal("signup", () => startEvaluation(navigate));
    return;
  }

  const content = document.getElementById("content");
  const pageTitle = document.getElementById("page-title");
  document.getElementById("modal")?.classList.add("hidden");

  pageTitle.textContent = "Full Evaluation";
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === "evaluation");
  });

  if (content) {
    content.innerHTML = `
      <section class="card loading-card">
        <div class="loader"></div>
        <h2>Starting evaluation…</h2>
        <p class="muted">Checking AI connection — please wait.</p>
      </section>`;
  }

  const state = loadState();
  if (state.evalStarted && !state.evalComplete && state.aiSession) {
    navigate("evaluation");
    return;
  }

  try {
    const aiStatus = await fetchAiStatus();
    if (!aiStatus.configured) {
      if (content) {
        content.innerHTML = `
          <section class="card ai-error-card">
            <h2>AI not connected</h2>
            <p class="lead">Add <code>OPENAI_API_KEY</code> in Vercel → Settings → Environment Variables, then redeploy.</p>
            <button class="btn primary" type="button" id="ai-back-dash">Back to dashboard</button>
          </section>`;
        content.querySelector("#ai-back-dash")?.addEventListener("click", () => navigate("dashboard"));
      }
      return;
    }

    resetEval();
    const s = loadState();
    s.evalStarted = true;
    s.evalCreditConsumed = false;
    s.profile.startedAt = new Date().toISOString();
    saveState(s);
    navigate("evaluation");
  } catch (err) {
    if (content) {
      content.innerHTML = `
        <section class="card ai-error-card">
          <h2>Could not start evaluation</h2>
          <p class="lead">${err.message}</p>
          <button class="btn primary" type="button" id="ai-back-dash">Back to dashboard</button>
        </section>`;
      content.querySelector("#ai-back-dash")?.addEventListener("click", () => navigate("dashboard"));
    }
  }
}

export function renderProfile(container) {
  const state = loadState();
  const report = state.report;
  const overall = report?.overall ?? "—";
  const grade = report ? gradeForScore(report.overall) : null;

  container.innerHTML = `
    <section class="card">
      <h2>Trader Profile</h2>
      <p class="muted">Built from your actions in the simulation.</p>
      ${
        report
          ? `<div class="profile-header">
              <div class="score-big">${overall}</div>
              <div>
                <span class="grade-pill ${grade.class}">${grade.label}</span>
                <h3>${report.archetype?.name || "Trader"}</h3>
                <p>${report.archetype?.summary || ""}</p>
              </div>
            </div>
            <div class="dim-grid">
              ${DIMENSIONS.filter((d) => d.id !== "journaling" || report.map?.journaling > 0)
                .map((d) => {
                  const sc = report.map?.[d.id] ?? "—";
                  return `<div class="dim-row"><span>${d.name}</span><div class="bar-track"><div class="bar-fill" style="width:${sc}%;background:${d.color}"></div></div><strong>${sc}</strong></div>`;
                })
                .join("")}
            </div>`
          : `<p class="empty">Complete an evaluation to unlock your profile.</p>
             <button class="btn primary" id="go-eval">Start evaluation</button>`
      }
    </section>
  `;

  container.querySelector("#go-eval")?.addEventListener("click", () => {
    startEvaluation(window.__navigate);
  });
}
