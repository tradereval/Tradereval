import { loadState, saveState } from "./store.js";
import { renderDashboard, renderProfile } from "./views/dashboard.js";
import { renderEvaluation, renderReport } from "./views/evaluation.js";
import { renderComingSoon } from "./views/placeholder.js";
import { gradeForScore } from "./data/dimensions.js";
import {
  initWishlistModal,
  openWishlistModal,
  refreshTopbarWaitlist,
} from "./wishlist.js";

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

async function navigate(view) {
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
}

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
  navigate(btn.dataset.view);
});

menuToggle.addEventListener("click", () => sidebar.classList.toggle("open"));

initWishlistModal();
document.getElementById("waitlist-top-btn")?.addEventListener("click", () =>
  openWishlistModal("topbar")
);

window.__navigate = navigate;
window.__refreshWishlistUI = async () => {
  await refreshTopbarWaitlist();
  if (document.querySelector("[data-view='dashboard'].active")) {
    navigate("dashboard");
  }
};

navigate("dashboard");
refreshTopbarWaitlist();
