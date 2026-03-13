import { supabase, isSupabaseConfigured, SITE_URL } from "./supabase.js";
import { showToast } from "./utils.js";

const form = document.getElementById("authForm");
const signupBtn = document.getElementById("signupBtn");
const resetBtn = document.getElementById("resetBtn");
// Google sign-in disabled by request.

const getRedirect = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get("redirect") || "index.html";
};

if (!isSupabaseConfigured) {
  showToast("Supabase is not configured. Update supabase.js.");
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabase) return;
  const data = new FormData(form);
  const email = String(data.get("email") || "").trim();
  const password = String(data.get("password") || "");

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    showToast("Incorrect email or password.");
    return;
  }
  window.location.href = getRedirect();
});

signupBtn?.addEventListener("click", async () => {
  if (!supabase) return;
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

resetBtn?.addEventListener("click", async () => {
  if (!supabase) return;
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
