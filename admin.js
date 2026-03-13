import { supabase, isSupabaseConfigured, STORAGE_BUCKET, SITE_URL } from "./supabase.js";
import { sanitizeText, sanitizeMultiline, hasProfanity, showToast, compressImages } from "./utils.js";

const ADMIN_EMAILS = [
  "jdingle@atomicmail.io",
  "odiealejua@gmail.com"
];

const adminContent = document.getElementById("adminContent");

const uploadImages = async (blobs, folder) => {
  const urls = [];
  for (let i = 0; i < blobs.length; i += 1) {
    const blob = blobs[i];
    const path = `${folder}/image_${i + 1}.jpg`;
    const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, blob, {
      upsert: true,
      contentType: "image/jpeg"
    });
    if (error) throw error;
    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    urls.push(data.publicUrl);
  }
  return urls;
};

const renderAuth = () => {
  if (!adminContent) return;
  if (!isSupabaseConfigured) {
    adminContent.innerHTML = `
      <div class="admin-grid">
        <div>
          <h2>Dev Options</h2>
          <p class="muted">Supabase is not configured. Update supabase.js with your project keys.</p>
        </div>
      </div>
    `;
    return;
  }

  adminContent.innerHTML = `
    <div class="admin-grid">
      <div>
        <h2>Dev Options</h2>
        <p class="muted">Sign in or create an admin account.</p>
      </div>
      <div class="admin-card">
        <form id="loginForm" class="form compact">
          <label>
            Email <span class="req">*</span>
            <input name="email" type="email" required />
          </label>
          <label>
            Password <span class="req">*</span>
            <input name="password" type="password" required />
          </label>
          <div class="admin-actions">
            <button class="pill primary" type="submit">Log In</button>
            <button id="signupBtn" class="pill" type="button">Sign Up</button>
          </div>
          <button id="resetBtn" class="pill ghost" type="button">Forgot password?</button>
        </form>
      </div>
    </div>
  `;

  document.getElementById("loginForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.target);
    const email = String(data.get("email") || "").trim();
    const password = String(data.get("password") || "");

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      showToast("Incorrect email or password.");
    }
  });

  document.getElementById("signupBtn")?.addEventListener("click", async () => {
    const form = document.getElementById("loginForm");
    const data = new FormData(form);
    const email = String(data.get("email") || "").trim();
    const password = String(data.get("password") || "");

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${SITE_URL}/auth.html` }
    });
    if (error) {
      showToast(error.message || "Signup failed.");
      return;
    }
    showToast("Account created. Check your email to verify.");
  });

  document.getElementById("resetBtn")?.addEventListener("click", async () => {
    const form = document.getElementById("loginForm");
    const data = new FormData(form);
    const email = String(data.get("email") || "").trim();
    if (!email) {
      showToast("Enter your email first.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${SITE_URL}/auth.html`
    });
    if (error) {
      showToast(error.message || "Reset failed.");
      return;
    }
    showToast("Password reset sent.");
  });

  // Google sign-in disabled by request.
};

const renderAdmin = async (user) => {
  if (!adminContent) return;

  const isAllowed = ADMIN_EMAILS.includes(user.email || "");
  let isAdmin = isAllowed;

  try {
    const { data } = await supabase
      .from("admins")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) isAdmin = true;
  } catch {
    // ignore if admins table not set yet
  }

  if (!isAdmin) {
    adminContent.innerHTML = `
      <div class="admin-grid">
        <div>
          <h2>Dev Options</h2>
          <p class="muted">This account does not have admin access.</p>
        </div>
        <div class="admin-card">
          <button id="logoutBtn" class="pill" type="button">Log Out</button>
        </div>
      </div>
    `;
    document.getElementById("logoutBtn")?.addEventListener("click", async () => {
      await supabase.auth.signOut();
    });
    return;
  }

  adminContent.innerHTML = `
    <div class="admin-grid">
      <div>
        <h2>Dev Options</h2>
        <p class="muted">Signed in as ${user.email || "admin"}. Manage requests and blueprints.</p>
      </div>

      <div class="admin-toolbar">
        <button class="pill" data-scroll="pending">Requests</button>
        <button class="pill" data-scroll="upload">Upload Blueprint</button>
        <button class="pill" data-scroll="live">Edit Blueprints</button>
        <button class="pill" data-scroll="live">Delete Blueprints</button>
        <button id="logoutBtn" class="pill" type="button">Log Out</button>
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

  document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    await supabase.auth.signOut();
  });
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

const listenRequests = async () => {
  const container = document.getElementById("pendingRequests");
  if (!container) return;

  const { data } = await supabase
    .from("requests")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  const requests = data || [];
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
            ${req.video_url ? `<div><span class="badge">Video</span> ${req.video_url}</div>` : ""}
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
};

const listenBlueprints = async () => {
  const container = document.getElementById("liveBlueprints");
  if (!container) return;

  const { data } = await supabase
    .from("blueprints")
    .select("*")
    .order("created_at", { ascending: false });

  const blueprints = data || [];
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
            <label>Video URL <input type="url" name="videoUrl" value="${bp.video_url || ""}" /></label>
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
};

const handleAccept = async (id) => {
  const card = document.querySelector(`[data-req="${id}"]`);
  const difficulty = Number(card?.querySelector(".difficulty-input")?.value || 3);
  const cost = Number(card?.querySelector(".cost-input")?.value || 3);

  const { data: request } = await supabase.from("requests").select("*").eq("id", id).maybeSingle();
  if (!request) return;

  await supabase.from("blueprints").insert({
    title: request.title,
    description: request.description,
    photos: request.photos || [],
    materials: request.materials,
    steps: request.steps,
    video_url: request.video_url || "",
    difficulty,
    cost,
    rating_sum: 0,
    rating_count: 0
  });

  await supabase.from("requests").update({ status: "accepted" }).eq("id", id);
  showToast("Blueprint accepted and published.");
  listenRequests();
  listenBlueprints();
};

const handleDeny = async (id) => {
  await supabase.from("requests").update({ status: "denied" }).eq("id", id);
  showToast("Request denied.");
  listenRequests();
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
    showToast("Upload failed. Check storage bucket policies.");
    return;
  }

  const photos = [...photoUrls, ...uploadUrls].slice(0, 3);

  if (hasProfanity(`${title} ${description} ${materials} ${steps}`)) {
    showToast("Please remove profanity before publishing.");
    return;
  }

  await supabase.from("blueprints").insert({
    title,
    description,
    photos,
    materials,
    steps,
    video_url: videoUrl,
    difficulty,
    cost,
    rating_sum: 0,
    rating_count: 0
  });

  form.reset();
  showToast("Blueprint published.");
  listenBlueprints();
};

const handleSave = async (id) => {
  const card = document.querySelector(`[data-blueprint="${id}"]`);
  if (!card) return;

  const payload = {
    title: sanitizeText(card.querySelector("[name=title]")?.value || ""),
    description: sanitizeText(card.querySelector("[name=description]")?.value || ""),
    materials: sanitizeMultiline(card.querySelector("[name=materials]")?.value || ""),
    steps: sanitizeMultiline(card.querySelector("[name=steps]")?.value || ""),
    video_url: sanitizeText(card.querySelector("[name=videoUrl]")?.value || ""),
    difficulty: Number(card.querySelector("[name=difficulty]")?.value || 1),
    cost: Number(card.querySelector("[name=cost]")?.value || 1)
  };

  if (hasProfanity(`${payload.title} ${payload.description} ${payload.materials} ${payload.steps}`)) {
    showToast("Please remove profanity before saving.");
    return;
  }

  await supabase.from("blueprints").update(payload).eq("id", id);
  showToast("Blueprint updated.");
  listenBlueprints();
};

const handleDelete = async (id) => {
  if (!id) return;
  if (!confirm("Delete this blueprint? This cannot be undone.")) return;
  await supabase.from("blueprints").delete().eq("id", id);
  showToast("Blueprint deleted.");
  listenBlueprints();
};

const handleFeature = async (id) => {
  await supabase.from("settings").upsert({ id: "site", featured_id: id });
  showToast("Featured blueprint updated.");
};

window.addEventListener("DOMContentLoaded", () => {
  if (!supabase) {
    renderAuth();
    return;
  }

  supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      renderAdmin(session.user);
    } else {
      renderAuth();
    }
  });
});
