import {
  showMainApp,
  showAuthScreen,
  updateAuthStatus,
  switchTab,
  toggleSidebar,
  newChat,
  handleKeyDown,
  handleSendMessage
} from "../components/ui.js";

import { loadConfig, checkAuth } from "./supabase.js";
import { signIn, signUp, signOut } from "./auth.js";

document.addEventListener("DOMContentLoaded", async () => {
  await loadConfig();

  const user = await checkAuth();
  user ? showMainApp() : showAuthScreen();

  /* -------- AUTH -------- */

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

    const email = signupEmail.value;
    const pass = signupPassword.value;
    const conf = signupConfirm.value;

    if (pass !== conf) {
      updateAuthStatus("passwords do not match", "error");
      return;
    }

    await signUp(email, pass);
    updateAuthStatus("account created", "success");
    switchTab("signin");
  });

  /* -------- CHAT -------- */

  document.getElementById("userInput")
    ?.addEventListener("keydown", handleKeyDown);

  document.querySelector('button[onclick="sendMessage()"]')
    ?.addEventListener("click", handleSendMessage);

  /* -------- SIDEBAR -------- */

  document.querySelectorAll('[onclick="toggleSidebar()"]')
    .forEach(b => b.addEventListener("click", toggleSidebar));

  document.querySelector('[onclick="newChat()"]')
    ?.addEventListener("click", newChat);

  document.querySelector('[onclick="signOut()"]')
    ?.addEventListener("click", signOut);
});
