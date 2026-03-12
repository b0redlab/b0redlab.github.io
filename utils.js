const leetMap = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "8": "b",
  "9": "g",
  "@": "a",
  "$": "s",
  "!": "i",
  "|": "i",
  "+": "t"
};

const profanity = [
  "shit",
  "fuck",
  "bitch",
  "bastard",
  "ass",
  "dick",
  "crap",
  "damn",
  "piss",
  "slut",
  "whore",
  "bad"
];

const LS_KEYS = {
  USER_ID: "bl_user_id"
};

// Strip HTML-like characters and tidy whitespace (single-line).
const sanitizeText = (value) =>
  String(value || "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim();

// Preserve line breaks while cleaning text (multi-line fields).
const sanitizeMultiline = (value) =>
  String(value || "")
    .replace(/[<>]/g, "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .join("\n")
    .trim();

// Normalize leetspeak and punctuation for profanity checks.
const normalize = (text) =>
  String(text || "")
    .toLowerCase()
    .split("")
    .map((ch) => leetMap[ch] || ch)
    .join("")
    .replace(/[^a-z0-9\s]/g, "");

const hasProfanity = (text) => {
  const clean = normalize(text);
  return profanity.some((bad) => new RegExp(`\\b${bad}\\b`, "i").test(clean));
};

// One rating per user, stored locally.
const getUserId = () => {
  let id = localStorage.getItem(LS_KEYS.USER_ID);
  if (!id) {
    id = `user_${crypto.randomUUID()}`;
    localStorage.setItem(LS_KEYS.USER_ID, id);
  }
  return id;
};

const showToast = (message) => {
  let toast = document.querySelector(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2400);
};

// Compress images before upload to keep storage light.
const compressImages = async (files, maxWidth = 1400, quality = 0.82) => {
  const limited = Array.from(files).slice(0, 3);
  const results = [];

  for (const file of limited) {
    const img = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.src = reader.result;
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });

    if (!img) continue;

    const scale = Math.min(1, maxWidth / img.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(img.width * scale);
    canvas.height = Math.floor(img.height * scale);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );

    if (blob) {
      results.push(blob);
    }
  }

  return results;
};

export {
  sanitizeText,
  sanitizeMultiline,
  hasProfanity,
  getUserId,
  showToast,
  compressImages
};
