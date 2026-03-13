import { supabase, isSupabaseConfigured } from "./supabase.js";
import { sanitizeMultiline, showToast } from "./utils.js";

const state = {
  filter: "all",
  blueprintCache: [],
  currentDetailId: null,
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

const goToLogin = () => {
  const redirect = encodeURIComponent(window.location.pathname);
  window.location.href = `auth.html?reason=login_required&redirect=${redirect}`;
};

const renderList = () => {
  const listEl = $("blueprintList");
  if (!listEl) return;

  let list = [...state.blueprintCache];
  if (state.filter === "best") {
    list.sort((a, b) => ratingAverage(b) - ratingAverage(a));
  }

  if (!list.length) {
    listEl.innerHTML = `<div class="muted">No blueprints yet. Submit a request to get started.</div>`;
    return;
  }

  listEl.innerHTML = list
    .map((bp) => {
      const avg = ratingAverage(bp);
      const cover = bp.photos?.[0] || "";
      const loginBadge = state.user ? "" : `<span class="pill-note">Login required</span>`;
      return `
        <div class="list-item">
          <img src="${cover}" alt="${bp.title}" />
          <div class="meta">
            <h3>${bp.title}</h3>
            <p class="muted">${bp.description}</p>
            <div class="stars-row">
              ${starsMarkup(avg)}
              ${starsMarkup(bp.difficulty, "red")}
              ${starsMarkup(bp.cost, "green")}
            </div>
          </div>
          <div class="list-actions">
            <button class="pill primary" data-open="${bp.id}" type="button">Get Blueprint ${loginBadge}</button>
          </div>
        </div>
      `;
    })
    .join("");
};

const showDetail = async (id) => {
  if (!state.user) {
    showToast("Login required.");
    goToLogin();
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
};

const closeDetail = () => {
  const detail = $("detailModal");
  if (!detail) return;
  detail.classList.remove("open");
  detail.setAttribute("aria-hidden", "true");
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
  $("showAllBtn")?.addEventListener("click", () => {
    state.filter = "all";
    renderList();
  });

  $("bestRatedBtn")?.addEventListener("click", () => {
    state.filter = "best";
    renderList();
  });

  $("closeDetailBtn")?.addEventListener("click", closeDetail);
  $("detailModal")?.addEventListener("click", (event) => {
    if (event.target.id === "detailModal") closeDetail();
  });

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const openId = target.getAttribute("data-open");
    const rateValue = target.getAttribute("data-rate-value");

    if (openId) showDetail(openId);
    if (rateValue && target.closest("#detailContent")) {
      if (state.currentDetailId) {
        submitRating(state.currentDetailId, Number(rateValue));
        target.parentElement?.querySelectorAll("button").forEach((btn) => {
          btn.classList.toggle("active", btn === target);
        });
      }
    }
  });
};

const fetchBlueprints = async () => {
  const { data } = await supabase.from("blueprints").select("*").order("created_at", { ascending: false });
  state.blueprintCache = data || [];
  renderList();
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
  bindEvents();
});
