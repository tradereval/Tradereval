import { runSplash } from "./splash.js";
import { loadState } from "./store.js";
import { renderDashboard, renderProfile, startEvaluation } from "./views/dashboard.js";
import { renderEvaluation, renderReport } from "./views/evaluation.js";
import { renderComingSoon } from "./views/placeholder.js";
import { gradeForScore } from "./data/dimensions.js";
import {
  initWishlistModal,
  openWishlistModal,
  refreshTopbarWaitlist,
} from "./wishlist.js";
import { loadAuth, isLoggedIn, openAuthModal, logout, refreshUser } from "./auth.js";

const TITLES = {
  dashboard: "Dashboard",
  evaluation: "Full Evaluation",
  report: "Your Trader Report",
  quizzes: "Quizzes",
  journal: "AI Journal",
  profile: "Trader Profile",
};

const content = document.getElementById("content");
const pageTitle = document.getElementById("page-title");
const overallBadge = document.getElementById("overall-badge");
const nav = document.getElementById("main-nav");
const sidebar = document.getElementById("sidebar");
const menuToggle = document.getElementById("menu-toggle");

function hideModal() {
  document.getElementById("modal")?.classList.add("hidden");
}

function showFatalError(message) {
  content.innerHTML = `
    <section class="card ai-error-card">
      <h2>Something went wrong</h2>
      <p class="lead">${message}</p>
      <div class="btn-row">
        <button class="btn primary" type="button" id="fatal-reload">Reload page</button>
        <button class="btn ghost" type="button" id="fatal-dashboard">Back to dashboard</button>
      </div>
    </section>`;
  content.querySelector("#fatal-reload")?.addEventListener("click", () => location.reload());
  content.querySelector("#fatal-dashboard")?.addEventListener("click", () => navigate("dashboard"));
}

async function navigate(view) {
  try {
    hideModal();

    if (view === "report" && !isLoggedIn()) {
      openAuthModal("signup", () => navigate("report"));
      view = "dashboard";
    }

    pageTitle.textContent = TITLES[view] ?? view;
    nav.querySelectorAll(".nav-item").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.view === view);
    });

    const ctx = { navigate };

    switch (view) {
      case "dashboard":
        renderDashboard(content, ctx, await refreshTopbarWaitlist());
        break;
      case "evaluation":
        await renderEvaluation(content, ctx);
        break;
      case "report":
        await renderReport(content, ctx);
        break;
      case "quizzes":
        renderComingSoon(
          content,
          "Knowledge Quizzes",
          "Static and AI-generated knowledge checks — layered on top of your action-based evaluation."
        );
        break;
      case "journal":
        renderComingSoon(
          content,
          "AI Journal",
          "Log real trades and cross-check simulated behavior vs live habits."
        );
        break;
      case "profile":
        renderProfile(content);
        break;
      default:
        renderDashboard(content, ctx);
    }

    updateBadge();
    sidebar.classList.remove("open");
  } catch (err) {
    console.error(err);
    showFatalError(err.message || "Unexpected error loading this page.");
  }
}

function updateAuthBadge() {
  const el = document.getElementById("auth-badge");
  if (!el) return;
  const auth = loadAuth();
  if (auth?.user) {
    const label = auth.user.unlimitedEvals ? "∞ evals" : `${auth.user.evalCredits ?? 0} eval`;
    el.textContent = `${label} · ${auth.user.email.split("@")[0]}`;
    el.className = "auth-badge signed-in";
  } else {
    el.textContent = "Sign up free";
    el.className = "auth-badge";
  }
}

async function onAuthChange() {
  hideModal();
  await refreshUser();
  updateAuthBadge();
  navigate("dashboard");
}

window.__onAuthChange = onAuthChange;

function updateBadge() {
  const state = loadState();
  const score = state.report?.overall;
  if (score != null) {
    const g = gradeForScore(score);
    overallBadge.textContent = `${score} · ${g.label}`;
    overallBadge.className = `overall-badge ${g.class}`;
  } else {
    overallBadge.textContent = "Not evaluated";
    overallBadge.className = "overall-badge";
  }
}

nav.addEventListener("click", (e) => {
  const btn = e.target.closest(".nav-item");
  if (!btn) return;
  const view = btn.dataset.view;
  if (view === "evaluation") {
    startEvaluation(navigate);
    return;
  }
  navigate(view);
});

menuToggle.addEventListener("click", () => sidebar.classList.toggle("open"));

initWishlistModal();
document.getElementById("waitlist-top-btn")?.addEventListener("click", () =>
  openWishlistModal("topbar")
);
document.getElementById("auth-badge")?.addEventListener("click", () => {
  if (isLoggedIn()) {
    if (confirm("Sign out?")) {
      logout();
      onAuthChange();
    }
  } else {
    openAuthModal("signup", onAuthChange);
  }
});

window.__navigate = navigate;
window.__refreshWishlistUI = async () => {
  await refreshTopbarWaitlist();
  updateAuthBadge();
  if (document.querySelector("[data-view='dashboard'].active")) {
    navigate("dashboard");
  }
};

async function boot() {
  await runSplash();
  document.getElementById("app")?.classList.remove("app-hidden");
  navigate("dashboard");
  refreshTopbarWaitlist();
  refreshUser().then(updateAuthBadge);
}

boot();

window.addEventListener("unhandledrejection", (e) => {
  console.error("Unhandled error:", e.reason);
  const msg = e.reason?.message || String(e.reason);
  if (msg && content && !content.querySelector(".ai-error-card")) {
    showFatalError(msg);
  }
});
