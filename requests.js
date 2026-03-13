import { supabase } from "./supabase.js";
import { sanitizeText, sanitizeMultiline, hasProfanity, showToast, compressImages } from "./utils.js";
import { STORAGE_BUCKET } from "./supabase.js";

const DRAFT_KEY = "bl_request_draft";

const uploadImages = async (blobs, folder) => {
  const urls = [];
  for (let i = 0; i < blobs.length; i += 1) {
    const blob = blobs[i];
    const path = `${folder}/image_${i + 1}.jpg`;
    const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, blob, {
      upsert: false,
      contentType: "image/jpeg"
    });
    if (error) throw new Error(error.message || "Upload failed");
    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    urls.push(data.publicUrl);
  }
  return urls;
};

const form = document.getElementById("requestForm");
if (form) {
  const fields = ["title", "description", "materials", "steps", "videoUrl"];

  const loadDraft = () => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      fields.forEach((name) => {
        const input = form.querySelector(`[name=${name}]`);
        if (input && draft[name]) input.value = draft[name];
      });
    } catch {
      // ignore bad draft
    }
  };

  const saveDraft = () => {
    const draft = {};
    fields.forEach((name) => {
      const input = form.querySelector(`[name=${name}]`);
      if (input) draft[name] = input.value;
    });
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  };

  fields.forEach((name) => {
    const input = form.querySelector(`[name=${name}]`);
    input?.addEventListener("input", saveDraft);
  });

  loadDraft();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!supabase) return;
    const data = new FormData(form);
    const title = sanitizeText(String(data.get("title") || ""));
    const description = sanitizeText(String(data.get("description") || ""));
    const materials = sanitizeMultiline(String(data.get("materials") || ""));
    const steps = sanitizeMultiline(String(data.get("steps") || ""));
    const videoUrl = sanitizeText(String(data.get("videoUrl") || ""));
    const files = data.getAll("photos");

    const textBlock = `${title} ${description} ${materials} ${steps} ${videoUrl}`;
    if (hasProfanity(textBlock)) {
      showToast("Please remove profanity before submitting.");
      return;
    }

    const { data: inserted, error } = await supabase
      .from("requests")
      .insert({
        title,
        description,
        materials,
        steps,
        video_url: videoUrl,
        photos: [],
        status: "pending"
      })
      .select()
      .single();

    if (error || !inserted) {
      showToast("Request failed. Please try again.");
      return;
    }

    let photos = [];
    try {
      const blobs = await compressImages(files);
      photos = blobs.length ? await uploadImages(blobs, `requests/${inserted.id}`) : [];
    } catch (err) {
      showToast(`Upload failed: ${err.message || "Check storage bucket policies."}`);
      return;
    }

    if (photos.length) {
      await supabase.from("requests").update({ photos }).eq("id", inserted.id);
    }

    form.reset();
    localStorage.removeItem(DRAFT_KEY);
    showToast("Request sent to admin panel.");
  });
}
