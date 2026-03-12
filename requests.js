import {
  db,
  storage,
  collection,
  addDoc,
  doc,
  updateDoc,
  serverTimestamp,
  ref,
  uploadBytes,
  getDownloadURL
} from "./firebase.js";
import { sanitizeText, sanitizeMultiline, hasProfanity, showToast, compressImages } from "./utils.js";

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

const form = document.getElementById("requestForm");
if (form) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const title = sanitizeText(String(data.get("title") || ""));
    const description = sanitizeText(String(data.get("description") || ""));
    const materials = sanitizeMultiline(String(data.get("materials") || ""));
    const steps = sanitizeMultiline(String(data.get("steps") || ""));
    const files = data.getAll("photos");
    const videoUrl = sanitizeText(String(data.get("videoUrl") || ""));

    const textBlock = `${title} ${description} ${materials} ${steps} ${videoUrl}`;
    if (hasProfanity(textBlock)) {
      showToast("Please remove profanity before submitting.");
      return;
    }

    const docRef = await addDoc(collection(db, "requests"), {
      title,
      description,
      materials,
      steps,
      photos: [],
      videoUrl,
      status: "pending",
      createdAt: serverTimestamp()
    });

    let photos = [];
    try {
      const blobs = await compressImages(files);
      photos = blobs.length
        ? await uploadImages(blobs, `requests/${docRef.id}`)
        : [];
    } catch (err) {
      showToast("Upload failed. Check Firebase Storage rules.");
      return;
    }

    if (photos.length) {
      await updateDoc(doc(db, "requests", docRef.id), { photos });
    }

    form.reset();
    showToast("Request sent to admin panel.");
  });
}
