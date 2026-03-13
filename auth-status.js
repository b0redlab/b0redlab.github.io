import { supabase, isSupabaseConfigured } from "./supabase.js";

const authStatus = document.getElementById("authStatus");
const authEmail = document.getElementById("authEmail");
const loginLink = document.getElementById("loginLink");
const loginHeroLink = document.getElementById("loginHeroLink");
const loginSideLink = document.getElementById("loginSideLink");
const logoutBtn = document.getElementById("logoutBtn");

const setLoggedOut = () => {
  if (authStatus) authStatus.hidden = true;
  if (authEmail) authEmail.textContent = "";
  if (loginLink) loginLink.hidden = false;
  if (loginHeroLink) loginHeroLink.hidden = false;
  if (loginSideLink) loginSideLink.hidden = false;
};

const setLoggedIn = (email) => {
  if (authStatus) authStatus.hidden = false;
  if (authEmail) authEmail.textContent = email || "Logged in";
  if (loginLink) loginLink.hidden = true;
  if (loginHeroLink) loginHeroLink.hidden = true;
  if (loginSideLink) loginSideLink.hidden = true;
};

if (!isSupabaseConfigured) {
  setLoggedOut();
} else {
  supabase.auth.getSession().then(({ data }) => {
    const user = data?.session?.user || null;
    if (user) {
      setLoggedIn(user.email);
    } else {
      setLoggedOut();
    }
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      setLoggedIn(session.user.email);
    } else {
      setLoggedOut();
    }
  });
}

logoutBtn?.addEventListener("click", async () => {
  if (!supabase) return;
  await supabase.auth.signOut();
  setLoggedOut();
});
