import {
  db,
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp
} from "./firebase.js";
import { sanitizeMultiline, getUserId, showToast } from "./utils.js";

const state = {
  filter: "all",
  blueprintCache: [],
  currentDetailId: null
};

const $ = (id) => document.getElementById(id);

const ratingAverage = (bp) => {
  if (!bp || !bp.ratingCount) return 0;
  return Math.round((bp.ratingSum / bp.ratingCount) * 10) / 10;
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
            <button class="pill primary" data-open="${bp.id}" type="button">Get Blueprint</button>
          </div>
        </div>
      `;
    })
    .join("");
};

const showDetail = async (id) => {
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
      ${bp.videoUrl ? `<div><h3>Video</h3><a class="pill ghost" href="${bp.videoUrl}" target="_blank" rel="noreferrer">Watch Video</a></div>` : ""}
    </div>
  `;

  detail.classList.add("open");
  detail.setAttribute("aria-hidden", "false");

  const statusEl = container.querySelector("[data-rating-status]");
  const userId = getUserId();
  const ratingRef = doc(db, "ratings", `${id}_${userId}`);
  const existing = await getDoc(ratingRef);
  if (existing.exists()) {
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
  const userId = getUserId();
  const ratingRef = doc(db, "ratings", `${id}_${userId}`);

  try {
    await runTransaction(db, async (tx) => {
      const ratingSnap = await tx.get(ratingRef);
      if (ratingSnap.exists()) throw new Error("already");
      const bpRef = doc(db, "blueprints", id);
      const bpSnap = await tx.get(bpRef);
      if (!bpSnap.exists()) throw new Error("missing");
      const data = bpSnap.data();
      const sum = (data.ratingSum || 0) + value;
      const count = (data.ratingCount || 0) + 1;
      tx.update(bpRef, { ratingSum: sum, ratingCount: count });
      tx.set(ratingRef, { blueprintId: id, userId, value, createdAt: serverTimestamp() });
    });

    showToast("Thanks for rating!");
    const statusEl = document.querySelector("[data-rating-status]");
    if (statusEl) statusEl.textContent = "Rating saved. Thanks!";
    document.querySelectorAll("[data-rate-value]").forEach((btn) => (btn.disabled = true));
  } catch (err) {
    showToast(err.message === "already" ? "You have already rated this blueprint." : "Rating failed. Please try again.");
  }
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

const listenBlueprints = () => {
  const blueprintQuery = query(collection(db, "blueprints"), orderBy("createdAt", "desc"));
  onSnapshot(blueprintQuery, (snapshot) => {
    state.blueprintCache = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
    renderList();
  });
};

window.addEventListener("DOMContentLoaded", () => {
  listenBlueprints();
  bindEvents();
});
