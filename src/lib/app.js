import {
  showMainApp,
  showAuthScreen,
  updateAuthStatus,
  switchTab,
  toggleSidebar,
  newChat,
  exportAllChats,
  deleteCurrentChat,
  handleKeyDown,
  handleSendMessage
} from "../components/ui.js";

import { loadConfig, checkAuth } from "./supabase.js";
import { signIn, signUp, signOut } from "./auth.js";

document.addEventListener("DOMContentLoaded", async () => {
  await loadConfig();

  const user = await checkAuth();
  if (user) {
    showMainApp();
  } else {
    showAuthScreen();
  }

  /* ---------- AUTH TABS ---------- */

  document
    .querySelector('[onclick="switchTab(\'signin\')"]')
    ?.addEventListener("click", () => switchTab("signin"));

  document
    .querySelector('[onclick="switchTab(\'signup\')"]')
    ?.addEventListener("click", () => switchTab("signup"));

  /* ---------- AUTH FORMS ---------- */

  document.getElementById("signinForm")?.addEventListener("submit", async e => {
    e.preventDefault();

    try {
      await signIn(
        document.getElementById("signinEmail").value,
        document.getElementById("signinPassword").value
      );
      showMainApp();
    } catch (err) {
      updateAuthStatus(err.message || "sign in failed", "error");
    }
  });

  document.getElementById("signupForm")?.addEventListener("submit", async e => {
    e.preventDefault();

    const email = document.getElementById("signupEmail").value;
    const password = document.getElementById("signupPassword").value;
    const confirm = document.getElementById("signupConfirm").value;

    if (password !== confirm) {
      updateAuthStatus("passwords do not match", "error");
      return;
    }

    try {
      await signUp(email, password);
      updateAuthStatus("account created, please sign in", "success");
      switchTab("signin");
    } catch (err) {
      updateAuthStatus(err.message || "signup failed", "error");
    }
  });

  /* ---------- CHAT ---------- */

  document
    .getElementById("userInput")
    ?.addEventListener("keydown", handleKeyDown);

  document
    .querySelector('button[onclick="sendMessage()"]')
    ?.addEventListener("click", handleSendMessage);

  /* ---------- SIDEBAR / ACTIONS ---------- */

  document
    .querySelector('button[onclick="newChat()"]')
    ?.addEventListener("click", newChat);

  document
    .querySelector('button[onclick="deleteCurrentChat()"]')
    ?.addEventListener("click", deleteCurrentChat);

  document
    .querySelector('button[onclick="exportAllChats()"]')
    ?.addEventListener("click", exportAllChats);

  document
    .querySelectorAll('button[onclick="toggleSidebar()"]')
    .forEach(btn =>
      btn.addEventListener("click", toggleSidebar)
    );

  document
    .querySelector('button[onclick="signOut()"]')
    ?.addEventListener("click", signOut);
});
