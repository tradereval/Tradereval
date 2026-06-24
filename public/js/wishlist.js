import { CONFIG } from "./config.js";

const JOINED_KEY = "tradereval_wishlist_joined";

export function hasJoinedWishlist() {
  return localStorage.getItem(JOINED_KEY) === "1";
}

export function markJoinedWishlist() {
  localStorage.setItem(JOINED_KEY, "1");
}

export async function fetchWishlistCount() {
  try {
    let res = await fetch("/api/wishlist");
    if (res.ok) {
      const data = await res.json();
      if (data.count != null) return data.count;
    }
    res = await fetch("/api/wishlist/count");
    if (!res.ok) return null;
    const data = await res.json();
    return data.count ?? 0;
  } catch {
    return null;
  }
}

export async function submitWishlist(payload) {
  const body = {
    email: payload.email.trim().toLowerCase(),
    name: payload.name?.trim() || "",
    experience: payload.experience || "",
    market: payload.market || "",
    source: payload.source || "website",
    joinedAt: new Date().toISOString(),
  };

  if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    throw new Error("Please enter a valid email address.");
  }

  if (CONFIG.formspreeUrl) {
    const res = await fetch(CONFIG.formspreeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("Could not join waitlist. Try again.");
    markJoinedWishlist();
    return { ok: true, via: "formspree" };
  }

  try {
    const res = await fetch("/api/wishlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not join waitlist.");
    markJoinedWishlist();
    return { ok: true, via: "server", count: data.count };
  } catch (err) {
    if (err.message && !err.message.includes("fetch")) throw err;
    throw new Error("Server not running. Start the site with START-HERE.bat first.");
  }
}

export function openWishlistModal(source = "website") {
  const modal = document.getElementById("modal");
  const panel = document.getElementById("modal-panel");
  const joined = hasJoinedWishlist();

  panel.innerHTML = `
    <div class="modal-content">
      <button class="modal-close" aria-label="Close" data-close-modal>&times;</button>
      ${
        joined
          ? `<div class="wishlist-success">
              <div class="success-icon">✓</div>
              <h2>You're on the waitlist</h2>
              <p>We'll email you when ${CONFIG.productName} launches — full 30-day eval, AI reports, and more.</p>
              <p class="muted">Try the free ${3}-day demo while you wait.</p>
              <button class="btn primary" data-close-modal>Close</button>
            </div>`
          : `<h2>Join the launch waitlist</h2>
              <p class="muted">${CONFIG.launchMessage}</p>
              <form id="wishlist-form" class="wishlist-form">
                <input type="hidden" name="source" value="${source}" />
                <div class="form-row">
                  <label>Email *</label>
                  <input type="email" name="email" required placeholder="you@email.com" autocomplete="email" />
                </div>
                <div class="form-row">
                  <label>Name (optional)</label>
                  <input type="text" name="name" placeholder="Your name" autocomplete="name" />
                </div>
                <div class="form-row">
                  <label>Trading experience</label>
                  <select name="experience">
                    <option value="">Select...</option>
                    <option value="beginner">Beginner (&lt; 6 months)</option>
                    <option value="intermediate">Intermediate (6 months – 3 years)</option>
                    <option value="advanced">Advanced (3+ years)</option>
                  </select>
                </div>
                <div class="form-row">
                  <label>Main market</label>
                  <select name="market">
                    <option value="">Select...</option>
                    <option value="xau">Gold / XAU</option>
                    <option value="forex">Forex</option>
                    <option value="indices">Indices</option>
                    <option value="crypto">Crypto</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <p class="form-note muted">No spam. Unsubscribe anytime. Stripe payments added only after launch.</p>
                <div id="wishlist-error" class="form-error hidden"></div>
                <button type="submit" class="btn primary full-width" id="wishlist-submit">Join waitlist — it's free</button>
              </form>`
      }
    </div>
  `;

  modal.classList.remove("hidden");

  if (!joined) {
    const form = panel.querySelector("#wishlist-form");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = panel.querySelector("#wishlist-submit");
      const errEl = panel.querySelector("#wishlist-error");
      errEl.classList.add("hidden");
      btn.disabled = true;
      btn.textContent = "Joining...";

      try {
        const fd = new FormData(form);
        const result = await submitWishlist({
          email: fd.get("email"),
          name: fd.get("name"),
          experience: fd.get("experience"),
          market: fd.get("market"),
          source: fd.get("source"),
        });
        if (result.count != null) updateWaitlistCountDisplay(result.count);
        openWishlistModal(source);
        window.__refreshWishlistUI?.();
      } catch (err) {
        errEl.textContent = err.message;
        errEl.classList.remove("hidden");
        btn.disabled = false;
        btn.textContent = "Join waitlist — it's free";
      }
    });
  }
}

export function initWishlistModal() {
  document.getElementById("modal")?.addEventListener("click", (e) => {
    if (e.target.matches("[data-close-modal], .modal-backdrop")) {
      document.getElementById("modal").classList.add("hidden");
    }
  });
}

export function wishlistBannerHtml(count) {
  const joined = hasJoinedWishlist();
  const countText =
    count != null && count > 0
      ? `<strong>${count}</strong> trader${count === 1 ? "" : "s"} on the waitlist`
      : "Be first to know when we launch";

  if (joined) {
    return `
      <section class="wishlist-banner joined">
        <div>
          <p class="eyebrow">Waitlist</p>
          <h3>You're in — we'll email you at launch</h3>
          <p class="muted">${countText}. Full product: 30-day sim, AI coaching, re-evaluations.</p>
        </div>
      </section>`;
  }

  return `
    <section class="wishlist-banner">
      <div>
        <p class="eyebrow">Launching soon</p>
        <h3>Like what you see? Join the free waitlist</h3>
        <p class="muted">${countText}. No payment now — Stripe only when we go live. Help us gauge interest.</p>
      </div>
      <button class="btn primary" data-open-wishlist="dashboard">Join waitlist</button>
    </section>`;
}

export function wireWishlistButtons(root = document) {
  root.querySelectorAll("[data-open-wishlist]").forEach((btn) => {
    btn.addEventListener("click", () => openWishlistModal(btn.dataset.openWishlist || "website"));
  });
}

function updateWaitlistCountDisplay(count) {
  const el = document.getElementById("waitlist-count-badge");
  if (el && count != null) {
    el.textContent = count > 0 ? `${count} waiting` : "Join waitlist";
  }
}

export async function refreshTopbarWaitlist() {
  const count = await fetchWishlistCount();
  updateWaitlistCountDisplay(count);
  return count;
}
