import {
  db,
  storage,
  collection,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  serverTimestamp,
  ref,
  uploadBytes,
  getDownloadURL
} from "./firebase.js";
import { sanitizeText, sanitizeMultiline, hasProfanity, showToast, compressImages } from "./utils.js";

const ADMIN_PASSWORD = "t@jding43";

const adminModal = document.getElementById("adminModal");
const adminContent = document.getElementById("adminContent");

const uploadImages = async (blobs, folder) => {
  const urls = [];
  for (let i = 0; i < blobs.length; i += 1) {
    const blob = blobs[i];
    const imageRef = ref(storage, `${folder}/image_${i + 1}.jpg`);
    await uploadBytes(imageRef, blob);
    const url = await getDownloadURL(imageRef);
    urls.push(url);
  }
  return urls;
};

const openAdmin = () => {
  if (!adminModal || !adminContent) return;
  adminModal.classList.add("open");
  adminModal.setAttribute("aria-hidden", "false");
  renderLogin();
};

const closeAdmin = () => {
  if (!adminModal) return;
  adminModal.classList.remove("open");
  adminModal.setAttribute("aria-hidden", "true");
};

const renderLogin = () => {
  adminContent.innerHTML = `
    <div class="admin-grid">
      <div>
        <h2>Admin Panel</h2>
        <p class="muted">Enter the password to review and publish blueprint requests.</p>
      </div>
      <div class="admin-card">
        <label>
          Password
          <input id="adminPassword" type="password" />
        </label>
        <button id="adminLogin" class="pill primary" type="button">Unlock</button>
      </div>
    </div>
  `;

  document.getElementById("adminLogin")?.addEventListener("click", () => {
    const value = document.getElementById("adminPassword")?.value || "";
    if (value === ADMIN_PASSWORD) {
      renderAdmin();
    } else {
      showToast("Incorrect password.");
    }
  });
};

const renderAdmin = () => {
  adminContent.innerHTML = `
    <div class="admin-grid">
      <div>
        <h2>Admin Panel</h2>
        <p class="muted">Approve requests or publish new blueprints directly.</p>
      </div>

      <div class="admin-card" id="pendingRequests">
        <h3>Pending Requests</h3>
        <div class="muted">Loading requests...</div>
      </div>

      <div class="admin-card">
        <h3>Manual Blueprint Upload</h3>
        <form id="adminAddForm" class="form">
          <label>
            Title
            <input name="title" type="text" required />
          </label>
          <label>
            Description
            <textarea name="description" rows="3" required></textarea>
          </label>
          <label>
            Photo URLs (comma separated)
            <input name="photoUrls" type="text" placeholder="https://..." />
          </label>
          <label>
            Photo Uploads (up to 3)
            <input name="photos" type="file" accept="image/*" multiple />
          </label>
          <label>
            Materials
            <textarea name="materials" rows="3" required></textarea>
          </label>
          <label>
            Steps
            <textarea name="steps" rows="4" required></textarea>
          </label>
          <label>
            Difficulty (1-5)
            <input name="difficulty" type="number" min="1" max="5" required />
          </label>
          <label>
            Cost (1-5)
            <input name="cost" type="number" min="1" max="5" required />
          </label>
          <button class="pill primary" type="submit">Publish Blueprint</button>
        </form>
      </div>

      <div class="admin-card" id="liveBlueprints">
        <h3>Live Blueprints</h3>
        <div class="muted">Loading blueprints...</div>
      </div>
    </div>
  `;

  bindAdminEvents();
  listenRequests();
  listenBlueprints();
};

const bindAdminEvents = () => {
  document.getElementById("adminAddForm")?.addEventListener("submit", handleManualAdd);
};

const listenRequests = () => {
  const container = document.getElementById("pendingRequests");
  if (!container) return;

  const q = query(
    collection(db, "requests"),
    where("status", "==", "pending"),
    orderBy("createdAt", "desc")
  );

  onSnapshot(q, (snapshot) => {
    const requests = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    container.innerHTML = `
      <h3>Pending Requests (${requests.length})</h3>
      ${requests
        .map(
          (req) => `
          <div class="admin-card" data-req="${req.id}">
            <strong>${req.title}</strong>
            <p class="muted">${req.description}</p>
            <div class="detail-photos">
              ${(req.photos || [])
                .map((src) => `<img src="${src}" alt="${req.title}" />`)
                .join("")}
            </div>
            <div class="list">
              <div><span class="badge">Materials</span> ${req.materials}</div>
              <div><span class="badge">Steps</span> ${sanitizeMultiline(req.steps).replace(/\n/g, "<br />")}</div>
            </div>
            <div class="list">
              <label>
                Difficulty (1-5)
                <input type="number" min="1" max="5" value="3" class="difficulty-input" />
              </label>
              <label>
                Cost (1-5)
                <input type="number" min="1" max="5" value="3" class="cost-input" />
              </label>
            </div>
            <div class="admin-actions">
              <button class="pill primary" data-accept="${req.id}" type="button">Accept</button>
              <button class="pill" data-deny="${req.id}" type="button">Deny</button>
            </div>
          </div>
        `
        )
        .join("") || `<div class="muted">No pending requests.</div>`}
    `;

    container.querySelectorAll("[data-accept]").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        const id = event.currentTarget.getAttribute("data-accept");
        handleAccept(id);
      });
    });

    container.querySelectorAll("[data-deny]").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        const id = event.currentTarget.getAttribute("data-deny");
        handleDeny(id);
      });
    });
  });
};

const listenBlueprints = () => {
  const container = document.getElementById("liveBlueprints");
  if (!container) return;

  const q = query(collection(db, "blueprints"), orderBy("createdAt", "desc"));
  onSnapshot(q, (snapshot) => {
    const blueprints = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    container.innerHTML = `
      <h3>Live Blueprints (${blueprints.length})</h3>
      ${blueprints
        .map(
          (bp) => `
          <div class="admin-card">
            <strong>${bp.title}</strong>
            <p class="muted">${bp.description}</p>
            <div class="detail-photos">
              ${(bp.photos || [])
                .map((src) => `<img src="${src}" alt="${bp.title}" />`)
                .join("")}
            </div>
            <div class="list">
              <div><span class="badge">Materials</span> ${bp.materials}</div>
              <div><span class="badge">Steps</span> ${sanitizeMultiline(bp.steps).replace(/\n/g, "<br />")}</div>
              <div><span class="badge">Rating</span> ${bp.ratingSum || 0} / ${bp.ratingCount || 0}</div>
              <div><span class="badge">Difficulty</span> ${bp.difficulty}</div>
              <div><span class="badge">Cost</span> ${bp.cost}</div>
            </div>
          </div>
        `
        )
        .join("") || `<div class="muted">No blueprints yet.</div>`}
    `;
  });
};

const handleAccept = async (id) => {
  const card = document.querySelector(`[data-req="${id}"]`);
  const difficulty = Number(card?.querySelector(".difficulty-input")?.value || 3);
  const cost = Number(card?.querySelector(".cost-input")?.value || 3);

  const reqRef = doc(db, "requests", id);
  const reqSnapshot = await getDoc(reqRef);
  if (!reqSnapshot.exists()) return;
  const request = reqSnapshot.data();

  await addDoc(collection(db, "blueprints"), {
    title: request.title,
    description: request.description,
    photos: request.photos || [],
    materials: request.materials,
    steps: request.steps,
    difficulty,
    cost,
    ratingSum: 0,
    ratingCount: 0,
    createdAt: serverTimestamp()
  });

  await updateDoc(reqRef, { status: "accepted" });
  showToast("Blueprint accepted and published.");
};

const handleDeny = async (id) => {
  await updateDoc(doc(db, "requests", id), { status: "denied" });
  showToast("Request denied.");
};

const handleManualAdd = async (event) => {
  event.preventDefault();
  const form = event.target;
  const data = new FormData(form);

  const title = sanitizeText(String(data.get("title") || ""));
  const description = sanitizeText(String(data.get("description") || ""));
  const materials = sanitizeMultiline(String(data.get("materials") || ""));
  const steps = sanitizeMultiline(String(data.get("steps") || ""));
  const difficulty = Number(data.get("difficulty"));
  const cost = Number(data.get("cost"));

  const photoUrls = String(data.get("photoUrls") || "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);

  const blobs = await compressImages(data.getAll("photos"));
  const uploadUrls = blobs.length
    ? await uploadImages(blobs, `blueprints/manual_${crypto.randomUUID()}`)
    : [];

  const photos = [...photoUrls, ...uploadUrls].slice(0, 3);

  if (hasProfanity(`${title} ${description} ${materials} ${steps}`)) {
    showToast("Please remove profanity before publishing.");
    return;
  }

  await addDoc(collection(db, "blueprints"), {
    title,
    description,
    photos,
    materials,
    steps,
    difficulty,
    cost,
    ratingSum: 0,
    ratingCount: 0,
    createdAt: serverTimestamp()
  });

  form.reset();
  showToast("Blueprint published.");
};

document.getElementById("adminBtn")?.addEventListener("click", openAdmin);
document.getElementById("closeAdminBtn")?.addEventListener("click", closeAdmin);
adminModal?.addEventListener("click", (event) => {
  if (event.target === adminModal) closeAdmin();
});
