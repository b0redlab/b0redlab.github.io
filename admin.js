import {
  db,
  storage,
  collection,
  addDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
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
const ADMIN_FLAG = "bl_admin";

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

const renderLogin = () => {
  if (!adminContent) return;
  adminContent.innerHTML = `
    <div class="admin-grid">
      <div>
        <h2>Dev Options</h2>
        <p class="muted">Enter the code once to unlock admin controls.</p>
      </div>
      <div class="admin-card">
        <label>
          Access Code
          <input id="adminPassword" type="password" />
        </label>
        <button id="adminLogin" class="pill primary" type="button">Unlock</button>
      </div>
    </div>
  `;

  document.getElementById("adminLogin")?.addEventListener("click", () => {
    const value = document.getElementById("adminPassword")?.value || "";
    if (value === ADMIN_PASSWORD) {
      localStorage.setItem(ADMIN_FLAG, "true");
      renderAdmin();
    } else {
      showToast("Incorrect code.");
    }
  });
};

const renderAdmin = () => {
  if (!adminContent) return;
  adminContent.innerHTML = `
    <div class="admin-grid">
      <div>
        <h2>Dev Options</h2>
        <p class="muted">Manage requests, publish new blueprints, and edit live content.</p>
      </div>

      <div class="admin-toolbar">
        <button class="pill" data-scroll="pending">Requests</button>
        <button class="pill" data-scroll="upload">Upload Blueprint</button>
        <button class="pill" data-scroll="live">Edit Blueprints</button>
        <button class="pill" data-scroll="live">Delete Blueprints</button>
      </div>

      <div class="admin-card" id="pendingRequests">
        <h3>Pending Requests</h3>
        <div class="muted">Loading requests...</div>
      </div>

      <div class="admin-card" id="uploadSection">
        <h3>Upload Blueprint</h3>
        <form id="adminAddForm" class="form compact">
          <label>
            Title <span class="req">*</span>
            <input name="title" type="text" required />
          </label>
          <label>
            Description <span class="req">*</span>
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
            Materials <span class="req">*</span>
            <textarea name="materials" rows="3" required></textarea>
          </label>
          <label>
            Steps <span class="req">*</span>
            <textarea name="steps" rows="4" required></textarea>
          </label>
          <label>
            Video URL (optional)
            <input name="videoUrl" type="url" placeholder="https://" />
          </label>
          <label>
            Difficulty (1-5) <span class="req">*</span>
            <input name="difficulty" type="number" min="1" max="5" required />
          </label>
          <label>
            Cost (1-5) <span class="req">*</span>
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
  document.querySelectorAll("[data-scroll]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      const target = event.currentTarget.getAttribute("data-scroll");
      if (target === "pending") document.getElementById("pendingRequests")?.scrollIntoView({ behavior: "smooth" });
      if (target === "upload") document.getElementById("uploadSection")?.scrollIntoView({ behavior: "smooth" });
      if (target === "live") document.getElementById("liveBlueprints")?.scrollIntoView({ behavior: "smooth" });
    });
  });
};

const listenRequests = () => {
  const container = document.getElementById("pendingRequests");
  if (!container) return;

  const q = query(collection(db, "requests"), where("status", "==", "pending"), orderBy("createdAt", "desc"));

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
              ${req.videoUrl ? `<div><span class="badge">Video</span> ${req.videoUrl}</div>` : ""}
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
          <div class="admin-card" data-blueprint="${bp.id}">
            <strong>${bp.title}</strong>
            <div class="detail-photos">
              ${(bp.photos || [])
                .map((src) => `<img src="${src}" alt="${bp.title}" />`)
                .join("")}
            </div>
            <div class="list">
              <label>Title <input type="text" name="title" value="${bp.title}" /></label>
              <label>Description <textarea name="description" rows="2">${bp.description}</textarea></label>
              <label>Materials <textarea name="materials" rows="2">${bp.materials || ""}</textarea></label>
              <label>Steps <textarea name="steps" rows="3">${bp.steps || ""}</textarea></label>
              <label>Video URL <input type="url" name="videoUrl" value="${bp.videoUrl || ""}" /></label>
              <label>Difficulty <input type="number" min="1" max="5" name="difficulty" value="${bp.difficulty}" /></label>
              <label>Cost <input type="number" min="1" max="5" name="cost" value="${bp.cost}" /></label>
            </div>
            <div class="admin-actions">
              <button class="pill primary" data-save="${bp.id}" type="button">Save Edits</button>
              <button class="pill" data-feature="${bp.id}" type="button">Set Featured</button>
              <button class="pill" data-delete="${bp.id}" type="button">Delete</button>
            </div>
          </div>
        `
        )
        .join("") || `<div class="muted">No blueprints yet.</div>`}
    `;

    container.querySelectorAll("[data-save]").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        const id = event.currentTarget.getAttribute("data-save");
        handleSave(id);
      });
    });

    container.querySelectorAll("[data-delete]").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        const id = event.currentTarget.getAttribute("data-delete");
        handleDelete(id);
      });
    });

    container.querySelectorAll("[data-feature]").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        const id = event.currentTarget.getAttribute("data-feature");
        handleFeature(id);
      });
    });
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
    videoUrl: request.videoUrl || "",
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
  const videoUrl = sanitizeText(String(data.get("videoUrl") || ""));
  const difficulty = Number(data.get("difficulty"));
  const cost = Number(data.get("cost"));

  const photoUrls = String(data.get("photoUrls") || "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);

  let uploadUrls = [];
  try {
    const blobs = await compressImages(data.getAll("photos"));
    uploadUrls = blobs.length
      ? await uploadImages(blobs, `blueprints/manual_${crypto.randomUUID()}`)
      : [];
  } catch (err) {
    showToast("Upload failed. Check Firebase Storage rules.");
    return;
  }

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
    videoUrl,
    difficulty,
    cost,
    ratingSum: 0,
    ratingCount: 0,
    createdAt: serverTimestamp()
  });

  form.reset();
  showToast("Blueprint published.");
};

const handleSave = async (id) => {
  const card = document.querySelector(`[data-blueprint="${id}"]`);
  if (!card) return;

  const payload = {
    title: sanitizeText(card.querySelector("[name=title]")?.value || ""),
    description: sanitizeText(card.querySelector("[name=description]")?.value || ""),
    materials: sanitizeMultiline(card.querySelector("[name=materials]")?.value || ""),
    steps: sanitizeMultiline(card.querySelector("[name=steps]")?.value || ""),
    videoUrl: sanitizeText(card.querySelector("[name=videoUrl]")?.value || ""),
    difficulty: Number(card.querySelector("[name=difficulty]")?.value || 1),
    cost: Number(card.querySelector("[name=cost]")?.value || 1)
  };

  if (hasProfanity(`${payload.title} ${payload.description} ${payload.materials} ${payload.steps}`)) {
    showToast("Please remove profanity before saving.");
    return;
  }

  await updateDoc(doc(db, "blueprints", id), payload);
  showToast("Blueprint updated.");
};

const handleDelete = async (id) => {
  if (!id) return;
  if (!confirm("Delete this blueprint? This cannot be undone.")) return;
  await deleteDoc(doc(db, "blueprints", id));
  showToast("Blueprint deleted.");
};

const handleFeature = async (id) => {
  await setDoc(doc(db, "settings", "site"), { featuredId: id }, { merge: true });
  showToast("Featured blueprint updated.");
};

window.addEventListener("DOMContentLoaded", () => {
  const unlocked = localStorage.getItem(ADMIN_FLAG) === "true";
  if (unlocked) {
    renderAdmin();
  } else {
    renderLogin();
  }
});
