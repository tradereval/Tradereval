import { DIMENSIONS, gradeForScore } from "../data/dimensions.js";
import { SIM_CONFIG } from "../data/simulation.js";
import { loadState, saveState, resetEval } from "../store.js";
import { wishlistBannerHtml, wireWishlistButtons } from "../wishlist.js";
import { getTotalWindows } from "../ai/session.js";
import {
  loadAuth,
  isLoggedIn,
  openAuthModal,
  checkEvalCredit,
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
        <p class="eyebrow">Test before you risk real capital</p>
        <h1>Train your execution.<br/>AI builds every scenario.</h1>
        <p class="lead">
          <strong>Test your skills before risking your capital.</strong> We train you and help you stabilize your execution —
          with <strong>new AI trades and quizzes every evaluation</strong>, so you practice real decisions, not memorized answers.
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
      <article class="card">
        <h3>Never the same twice</h3>
        <p>AI generates fresh market situations every time — traders can't cheat by memorizing.</p>
      </article>
      <article class="card">
        <h3>Trades + Q&amp;A</h3>
        <p>Click real decisions on charts, answer judgment questions — AI scores behavior.</p>
      </article>
      <article class="card">
        <h3>AI coaching report</h3>
        <p>Personalized mistakes and fixes — no manual content updates from us.</p>
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

  const state = loadState();
  if (state.evalStarted && !state.evalComplete && state.aiSession) {
    navigate("evaluation");
    return;
  }

  try {
    const aiStatus = await fetchAiStatus();
    if (!aiStatus.configured) {
      alert(
        "AI is not connected yet. Add OPENAI_API_KEY in Vercel → Settings → Environment Variables, then Redeploy."
      );
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
    alert(err.message);
    await checkEvalCredit();
    navigate("dashboard");
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
