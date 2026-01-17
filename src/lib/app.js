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

import { checkAuth } from "./supabase.js";
import { signIn, signUp, signOut } from "./auth.js";

document.addEventListener("DOMContentLoaded", async () => {
  /* -------- AUTH CHECK -------- */

  let user = null;
  try {
    user = await checkAuth();
  } catch (err) {
    console.error("auth check failed", err);
  }

  user ? showMainApp() : showAuthScreen();

  /* -------- TAB SWITCHING -------- */

  document.getElementById("signinTab")
    ?.addEventListener("click", () => switchTab("signin"));

  document.getElementById("signupTab")
    ?.addEventListener("click", () => switchTab("signup"));

  /* -------- SIGN IN -------- */

  document.getElementById("signinForm")
    ?.addEventListener("submit", async e => {
      e.preventDefault();

      const email = document.getElementById("signinEmail")?.value;
      const password = document.getElementById("signinPassword")?.value;

      try {
        await signIn(email, password);
        showMainApp();
      } catch (err) {
        updateAuthStatus(err.message || "sign in failed", "error");
      }
    });

  /* -------- SIGN UP -------- */

  document.getElementById("signupForm")
    ?.addEventListener("submit", async e => {
      e.preventDefault();

      const email = document.getElementById("signupEmail")?.value;
      const password = document.getElementById("signupPassword")?.value;
      const confirm = document.getElementById("signupConfirm")?.value;

      if (password !== confirm) {
        updateAuthStatus("passwords do not match", "error");
        return;
      }

      try {
        await signUp(email, password);
        updateAuthStatus("account created", "success");
        switchTab("signin");
      } catch (err) {
        updateAuthStatus(err.message || "signup failed", "error");
      }
    });

  /* -------- CHAT INPUT -------- */

  document.getElementById("userInput")
    ?.addEventListener("keydown", handleKeyDown);

  document.getElementById("sendBtn")
    ?.addEventListener("click", handleSendMessage);

  /* -------- SIDEBAR -------- */

  document.getElementById("toggleSidebarBtn")
    ?.addEventListener("click", toggleSidebar);

  document.getElementById("newChatBtn")
    ?.addEventListener("click", newChat);

  /* -------- SIGN OUT -------- */

  document.getElementById("signOutBtn")
    ?.addEventListener("click", async () => {
      try {
        await signOut();
        showAuthScreen();
      } catch (err) {
        console.error("sign out failed", err);
      }
    });
});
