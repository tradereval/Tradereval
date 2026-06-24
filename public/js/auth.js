const AUTH_KEY = "tradereval_auth";

export function loadAuth() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveAuth(auth) {
  if (auth) localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
  else localStorage.removeItem(AUTH_KEY);
}

export function isLoggedIn() {
  return !!(loadAuth()?.token && loadAuth()?.user?.email);
}

export function authHeaders() {
  const auth = loadAuth();
  return auth?.token
    ? { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
}

async function parseJsonResponse(res) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      res.ok
        ? "Invalid server response."
        : text.startsWith("A server error")
          ? "Server error — sign-up storage may not be configured yet."
          : text.slice(0, 160)
    );
  }
}

export async function signup({ email, name, password }) {
  const res = await fetch("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, name, password }),
  });
  const data = await parseJsonResponse(res);
  if (!res.ok) throw new Error(data.error || "Signup failed");
  saveAuth({ token: data.token, user: data.user });
  return data;
}

export async function login({ email, password }) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await parseJsonResponse(res);
  if (!res.ok) throw new Error(data.error || "Login failed");
  saveAuth({ token: data.token, user: data.user });
  return data;
}

export function logout() {
  saveAuth(null);
}

export async function refreshUser() {
  const auth = loadAuth();
  if (!auth?.token) return null;
  const res = await fetch("/api/auth/me", { headers: { Authorization: `Bearer ${auth.token}` } });
  const data = await parseJsonResponse(res);
  if (!res.ok) {
    logout();
    return null;
  }
  saveAuth({ token: auth.token, user: data.user });
  return data.user;
}

export async function consumeEvalCredit() {
  const auth = loadAuth();
  if (!auth?.token) throw new Error("Sign in required.");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch("/api/eval/consume", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({}),
      signal: controller.signal,
    });
    const data = await parseJsonResponse(res);
    if (!res.ok) throw new Error(data.error || "Cannot start evaluation");
    saveAuth({ token: auth.token, user: data.user });
    return data;
  } catch (err) {
    if (err.name === "AbortError") throw new Error("Server slow — try again.");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function checkEvalCredit() {
  const auth = loadAuth();
  if (!auth?.token) return { canEvaluate: false, user: null };
  const res = await fetch("/api/eval/consume", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ checkOnly: true }),
  });
  const data = await parseJsonResponse(res);
  if (!res.ok) return { canEvaluate: false, user: auth.user };
  if (data.user) saveAuth({ token: auth.token, user: data.user });
  return { canEvaluate: data.canEvaluate, user: data.user };
}

export function openAuthModal(mode = "signup", onSuccess) {
  const modal = document.getElementById("modal");
  const panel = document.getElementById("modal-panel");

  panel.innerHTML = `
    <div class="modal-content auth-modal">
      <button class="modal-close" data-close-modal>&times;</button>
      <h2>${mode === "login" ? "Sign in" : "Create free account"}</h2>
      <p class="muted">Sign up is free. <strong>Every new email gets 1 free AI evaluation.</strong></p>
      <div class="auth-tabs">
        <button type="button" class="auth-tab ${mode === "signup" ? "active" : ""}" data-tab="signup">Sign up</button>
        <button type="button" class="auth-tab ${mode === "login" ? "active" : ""}" data-tab="login">Sign in</button>
      </div>
      <form id="auth-form" class="wishlist-form">
        <div class="form-row name-row ${mode === "login" ? "hidden" : ""}">
          <label>Name (optional)</label>
          <input type="text" name="name" placeholder="Your name" autocomplete="name" />
        </div>
        <div class="form-row">
          <label>Email</label>
          <input type="email" name="email" required placeholder="you@email.com" autocomplete="email" />
        </div>
        <div class="form-row">
          <label>Password</label>
          <input type="password" name="password" required minlength="6" placeholder="Min 6 characters" autocomplete="${mode === "login" ? "current-password" : "new-password"}" />
        </div>
        <div id="auth-error" class="form-error hidden"></div>
        <button type="submit" class="btn primary full-width" id="auth-submit">
          ${mode === "login" ? "Sign in" : "Sign up — get 1 free eval"}
        </button>
      </form>
    </div>
  `;

  modal.classList.remove("hidden");
  let currentMode = mode;

  panel.querySelectorAll(".auth-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      currentMode = tab.dataset.tab;
      panel.querySelectorAll(".auth-tab").forEach((t) => t.classList.toggle("active", t === tab));
      panel.querySelector(".name-row")?.classList.toggle("hidden", currentMode === "login");
      panel.querySelector("#auth-submit").textContent =
        currentMode === "login" ? "Sign in" : "Sign up — get 1 free eval";
    });
  });

  panel.querySelector("#auth-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errEl = panel.querySelector("#auth-error");
    const btn = panel.querySelector("#auth-submit");
    errEl.classList.add("hidden");
    btn.disabled = true;

    const fd = new FormData(e.target);
    try {
      if (currentMode === "login") {
        await login({ email: fd.get("email"), password: fd.get("password") });
      } else {
        await signup({
          email: fd.get("email"),
          name: fd.get("name"),
          password: fd.get("password"),
        });
      }
      modal.classList.add("hidden");
      window.__onAuthChange?.();
      onSuccess?.();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove("hidden");
      btn.disabled = false;
    }
  });
}
