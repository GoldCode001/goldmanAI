import {
  showMainApp,
  showAuthScreen,
  updateAuthStatus,
  switchTab,
  toggleSidebar,
  newChat,
  exportAllChats,
  deleteCurrentChat
} from "../components/ui.js";

import { handleSendMessage } from "./chat.js";
import { loadConfig, checkAuth } from "./supabase.js";
import { signIn, signUp, signOut } from "./auth.js";

document.addEventListener("DOMContentLoaded", async () => {

  await loadConfig();

  const user = await checkAuth();
  user ? showMainApp() : showAuthScreen();

  // AUTH TABS
  document.getElementById("signinTab")
    ?.addEventListener("click", () => switchTab("signin"));

  document.getElementById("signupTab")
    ?.addEventListener("click", () => switchTab("signup"));

  // AUTH FORMS
  document.getElementById("signinForm")
    ?.addEventListener("submit", async e => {
      e.preventDefault();
      await signIn(
        signinEmail.value,
        signinPassword.value
      );
      showMainApp();
    });

  document.getElementById("signupForm")
    ?.addEventListener("submit", async e => {
      e.preventDefault();
      if (signupPassword.value !== signupConfirm.value) {
        updateAuthStatus("passwords do not match", "error");
        return;
      }
      await signUp(signupEmail.value, signupPassword.value);
      switchTab("signin");
    });

  // CHAT
  document.getElementById("sendBtn")
    ?.addEventListener("click", handleSendMessage);

  document.getElementById("userInput")
    ?.addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    });

  document.getElementById("newChatBtn")
    ?.addEventListener("click", newChat);

  document.getElementById("deleteChatBtn")
    ?.addEventListener("click", deleteCurrentChat);

  document.getElementById("exportChatsBtn")
    ?.addEventListener("click", exportAllChats);

  document.getElementById("toggleSidebarBtn")
    ?.addEventListener("click", toggleSidebar);

  document.getElementById("signOutBtn")
    ?.addEventListener("click", signOut);
});
