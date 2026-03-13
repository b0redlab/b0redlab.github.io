import { supabase, isSupabaseConfigured } from "./supabase.js";
import { sanitizeMultiline, showToast } from "./utils.js";

const state = {
  filter: "all",
  blueprintCache: [],
  openRating: false,
  currentDetailId: null,
  featuredId: null,
  user: null
};

const $ = (id) => document.getElementById(id);

const ratingAverage = (bp) => {
  if (!bp || !bp.rating_count) return 0;
  return Math.round((bp.rating_sum / bp.rating_count) * 10) / 10;
};

const starsMarkup = (value, colorClass) => {
  const filled = Math.round(value);
  return `
    <div class="stars ${colorClass || ""}">
      ${[1, 2, 3, 4, 5]
        .map((i) => `<span class="star ${i <= filled ? "filled" : ""}">&#9733;</span>`)
        .join("")}
    </div>
  `;
};

const renderFeatured = () => {
  const titleEl = $("featuredTitle");
  const metaEl = $("featuredMeta");
  if (!titleEl || !metaEl) return;

  const featured = state.blueprintCache.find((bp) => bp.id === state.featuredId) || state.blueprintCache[0];
  if (!featured) {
    titleEl.textContent = "No blueprints yet";
    metaEl.innerHTML = "";
    return;
  }

  titleEl.textContent = featured.title;
  const avg = ratingAverage(featured);
  metaEl.innerHTML = `
    <div>
      <span class="label">Rating</span>
      ${starsMarkup(avg)}
    </div>
    <div>
      <span class="label">Difficulty</span>
      ${starsMarkup(featured.difficulty, "red")}
    </div>
    <div>
      <span class="label">Cost</span>
      ${starsMarkup(featured.cost, "green")}
    </div>
  `;
};

const renderBlueprints = () => {
  const grid = $("blueprintGrid");
  if (!grid) return;

  let list = [...state.blueprintCache];
  if (state.filter === "best") {
    list.sort((a, b) => ratingAverage(b) - ratingAverage(a));
  }

  list = list.slice(0, 5);

  if (!list.length) {
    grid.innerHTML = `<div class="muted">No blueprints yet. Submit a request to get started.</div>`;
    return;
  }

  grid.innerHTML = list
    .map((bp) => {
      const avg = ratingAverage(bp);
      const cover = bp.photos?.[0] || "";
      return `
        <article class="card">
          <img src="${cover}" alt="${bp.title}" />
          <div>
            <div class="title">${bp.title}</div>
            <p class="desc">${bp.description}</p>
          </div>
          <div class="rating-block">
            <div>${starsMarkup(avg)}</div>
            <div class="badge">${avg} rating (${bp.rating_count || 0})</div>
            <div>${starsMarkup(bp.difficulty, "red")}</div>
            <div>${starsMarkup(bp.cost, "green")}</div>
          </div>
          <div class="card-actions">
            <button class="pill primary" data-open="${bp.id}" type="button">Get Blueprint</button>
            <button class="pill ghost" data-rate="${bp.id}" type="button">Rate</button>
          </div>
        </article>
      `;
    })
    .join("");
};

const showDetail = async (id) => {
  if (!state.user) {
    const detail = $("detailModal");
    const container = $("detailContent");
    if (detail && container) {
      container.innerHTML = `
        <div class="detail-grid">
          <div>
            <h2>Log in to view full blueprint</h2>
            <p class="muted">Create a free account to access materials, steps, and video links.</p>
          </div>
          <div class="admin-actions">
            <a class="pill primary" href="auth.html?redirect=${encodeURIComponent(window.location.pathname)}">Log In / Sign Up</a>
            <button id="guestClose" class="pill" type="button">Continue as guest</button>
          </div>
        </div>
      `;
      detail.classList.add("open");
      detail.setAttribute("aria-hidden", "false");
      document.getElementById("guestClose")?.addEventListener("click", closeDetail);
    }
    return;
  }

  const detail = $("detailModal");
  const container = $("detailContent");
  const bp = state.blueprintCache.find((item) => item.id === id);
  if (!bp || !detail || !container) return;
  state.currentDetailId = id;

  const avg = ratingAverage(bp);
  container.innerHTML = `
    <div class="detail-grid">
      <div>
        <h2>${bp.title}</h2>
        <p class="muted">${bp.description}</p>
      </div>
      <div class="detail-photos">
        ${(bp.photos || []).map((src) => `<img src="${src}" alt="${bp.title}" />`).join("")}
      </div>
      <div class="detail-meta">
        <div>
          <span class="badge">Rating</span>
          ${starsMarkup(avg)}
        </div>
        <div>
          <span class="badge">Difficulty</span>
          ${starsMarkup(bp.difficulty, "red")}
        </div>
        <div>
          <span class="badge">Cost</span>
          ${starsMarkup(bp.cost, "green")}
        </div>
      </div>
      <div class="rating-ui" data-rating-ui>
        <h3>Rate This Blueprint</h3>
        <div class="rating-stars" data-rating-stars>
          ${[1, 2, 3, 4, 5]
            .map((i) => `<button type="button" data-rate-value="${i}">&#9733;</button>`)
            .join("")}
        </div>
        <p class="badge" data-rating-status>One rating per user.</p>
      </div>
      <div>
        <h3>Materials</h3>
        <p class="muted">${sanitizeMultiline(bp.materials).replace(/\n/g, "<br />")}</p>
      </div>
      <div>
        <h3>Steps</h3>
        <p class="muted">${sanitizeMultiline(bp.steps).replace(/\n/g, "<br />")}</p>
      </div>
      ${bp.video_url ? `<div><h3>Video</h3><a class="pill ghost" href="${bp.video_url}" target="_blank" rel="noreferrer">Watch Video</a></div>` : ""}
    </div>
  `;

  detail.classList.add("open");
  detail.setAttribute("aria-hidden", "false");

  const statusEl = container.querySelector("[data-rating-status]");
  const userId = state.user?.id;
  if (!userId) return;
  const { data: existing } = await supabase
    .from("ratings")
    .select("id")
    .eq("blueprint_id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    statusEl.textContent = "You already rated this blueprint.";
    container.querySelectorAll("[data-rate-value]").forEach((btn) => (btn.disabled = true));
  }

  if (state.openRating) {
    container.querySelector("[data-rating-ui]")?.scrollIntoView({ behavior: "smooth" });
    state.openRating = false;
  }
};

const closeDetail = () => {
  const detail = $("detailModal");
  if (!detail) return;
  detail.classList.remove("open");
  detail.setAttribute("aria-hidden", "true");
};

const openMenu = () => {
  const panel = $("sidePanel");
  if (!panel) return;
  panel.classList.add("open");
  panel.setAttribute("aria-hidden", "false");
};

const closeMenu = () => {
  const panel = $("sidePanel");
  if (!panel) return;
  panel.classList.remove("open");
  panel.setAttribute("aria-hidden", "true");
};

const submitRating = async (id, value) => {
  const userId = state.user?.id;
  if (!userId) return;

  const { data: existing } = await supabase
    .from("ratings")
    .select("id")
    .eq("blueprint_id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    showToast("You have already rated this blueprint.");
    return;
  }

  const { data: bp } = await supabase
    .from("blueprints")
    .select("rating_sum,rating_count")
    .eq("id", id)
    .maybeSingle();

  await supabase.from("ratings").insert({
    blueprint_id: id,
    user_id: userId,
    value
  });

  await supabase
    .from("blueprints")
    .update({
      rating_sum: (bp?.rating_sum || 0) + value,
      rating_count: (bp?.rating_count || 0) + 1
    })
    .eq("id", id);

  showToast("Thanks for rating!");
  const statusEl = document.querySelector("[data-rating-status]");
  if (statusEl) statusEl.textContent = "Rating saved. Thanks!";
  document.querySelectorAll("[data-rate-value]").forEach((btn) => (btn.disabled = true));
  await fetchBlueprints();
};

const bindEvents = () => {
  $("getStartedBtn")?.addEventListener("click", () => {
    state.filter = "all";
    renderBlueprints();
    document.getElementById("blueprints")?.scrollIntoView({ behavior: "smooth" });
  });

  $("menuBtn")?.addEventListener("click", openMenu);
  $("closePanelBtn")?.addEventListener("click", closeMenu);

  $("sideBestRated")?.addEventListener("click", () => {
    state.filter = "best";
    renderBlueprints();
    closeMenu();
    document.getElementById("blueprints")?.scrollIntoView({ behavior: "smooth" });
  });

  $("showAllBtn")?.addEventListener("click", () => {
    state.filter = "all";
    renderBlueprints();
  });

  $("bestRatedBtn")?.addEventListener("click", () => {
    state.filter = "best";
    renderBlueprints();
  });

  $("closeDetailBtn")?.addEventListener("click", closeDetail);
  $("detailModal")?.addEventListener("click", (event) => {
    if (event.target.id === "detailModal") closeDetail();
  });

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const openId = target.getAttribute("data-open");
    const rateId = target.getAttribute("data-rate");
    const rateValue = target.getAttribute("data-rate-value");

    if (openId) showDetail(openId);
    if (rateId) {
      state.openRating = true;
      showDetail(rateId);
    }
    if (rateValue && target.closest("#detailContent")) {
      if (state.currentDetailId) {
        submitRating(state.currentDetailId, Number(rateValue));
        target.parentElement?.querySelectorAll("button").forEach((btn) => {
          btn.classList.toggle("active", btn === target);
        });
      }
    }
  });

  const accordion = document.querySelector(".accordion");
  const panel = document.querySelector(".panel");
  accordion?.addEventListener("click", () => {
    if (!panel) return;
    const isOpen = panel.classList.toggle("open");
    if (isOpen) {
      panel.style.height = `${panel.scrollHeight}px`;
    } else {
      panel.style.height = "0px";
    }
    accordion.setAttribute("aria-expanded", String(isOpen));
    panel.setAttribute("aria-hidden", String(!isOpen));
  });

  const secret = "boredlabsdev";
  let buffer = "";
  document.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key.length !== 1) return;
    buffer = (buffer + event.key.toLowerCase()).slice(-secret.length);
    if (buffer === secret) {
      window.location.href = "admin.html";
      buffer = "";
    }
  });
};

const fetchFeatured = async () => {
  const { data } = await supabase.from("settings").select("featured_id").eq("id", "site").maybeSingle();
  state.featuredId = data?.featured_id || null;
  renderFeatured();
};

const fetchBlueprints = async () => {
  const { data } = await supabase.from("blueprints").select("*").order("created_at", { ascending: false });
  state.blueprintCache = data || [];
  renderBlueprints();
  renderFeatured();
};

window.addEventListener("DOMContentLoaded", async () => {
  if (!isSupabaseConfigured) {
    showToast("Supabase is not configured. Update supabase.js.");
    return;
  }

  const { data } = await supabase.auth.getSession();
  state.user = data?.session?.user || null;
  supabase.auth.onAuthStateChange((_event, session) => {
    state.user = session?.user || null;
  });

  await fetchBlueprints();
  await fetchFeatured();
  bindEvents();
});
