import {
  showMainApp,
  showAuthScreen,
  updateAuthStatus,
  switchTab,
  toggleSidebar,
  renderMessages,
  renderChatList,
  clearChatUI,
  handleKeyDown
} from "../components/ui.js";

import { initAssistantFace } from "../components/assistantFace.js";
import { checkAuth } from "./supabase.js";
import { signIn, signUp, signOut } from "./auth.js";

const API = "https://aibackend-production-a44f.up.railway.app";

window.currentChatId = null;
window.chatCache = [];

/* ================= BOOT ================= */

document.addEventListener("DOMContentLoaded", async () => {
  const user = await checkAuth();

  if (!user) {
    showAuthScreen();
    return;
  }

  showMainApp();
  await ensureUser(user);
  await loadChats(user.id);

  bindEvents();
  initAssistantFace();
});

/* ================= EVENTS ================= */

function bindEvents() {
  document.getElementById("signinForm")?.addEventListener("submit", onSignIn);
  document.getElementById("signupForm")?.addEventListener("submit", onSignUp);

  document.getElementById("sendBtn")?.addEventListener("click", sendMessage);
  document.getElementById("userInput")?.addEventListener("keydown", handleKeyDown);

  document.getElementById("newChatBtn")?.addEventListener("click", createNewChat);
  document.getElementById("signOutBtn")?.addEventListener("click", signOut);
  document.getElementById("toggleSidebarBtn")?.addEventListener("click", toggleSidebar);
}

/* ================= AUTH ================= */

async function onSignIn(e) {
  e.preventDefault();
  try {
    await signIn(signinEmail.value, signinPassword.value);
    location.reload();
  } catch (err) {
    updateAuthStatus(err.message, "error");
  }
}

async function onSignUp(e) {
  e.preventDefault();
  if (signupPassword.value !== signupConfirm.value) {
    updateAuthStatus("passwords do not match", "error");
    return;
  }
  await signUp(signupEmail.value, signupPassword.value);
  switchTab("signin");
}

/* ================= CHAT ================= */

async function loadChats(userId) {
  const res = await fetch(`${API}/api/chat/list/${userId}`);
  const chats = await res.json();

  window.chatCache = chats;

  if (!chats.length) {
    await createNewChat();
    return;
  }

  window.currentChatId = chats[0].id;
  renderChatList(chats, window.currentChatId);
  await loadChatById(window.currentChatId);
}

window.loadChatById = async function (chatId) {
  window.currentChatId = chatId;
  clearChatUI();

  const res = await fetch(`${API}/api/chat/${chatId}`);
  const messages = await res.json();

  renderMessages(messages);
  renderChatList(window.chatCache, chatId);
};

async function createNewChat() {
  const res = await fetch(`${API}/api/chat/new`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: window.currentUser.id })
  });

  const chat = await res.json();
  window.chatCache.unshift(chat);
  window.currentChatId = chat.id;

  renderChatList(window.chatCache, chat.id);
  clearChatUI();
}

async function sendMessage() {
  const input = document.getElementById("userInput");
  const text = input.value.trim();
  if (!text || !window.currentChatId) return;

  input.value = "";

  await fetch(`${API}/api/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chatId: window.currentChatId,
      role: "user",
      content: text
    })
  });

  const aiRes = await fetch(`${API}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: text }]
    })
  });

  const aiData = await aiRes.json();

  await fetch(`${API}/api/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chatId: window.currentChatId,
      role: "assistant",
      content: aiData.content
    })
  });

  await loadChatById(window.currentChatId);
}

/* ================= USER ================= */

async function ensureUser(user) {
  window.currentUser = user;

  await fetch(`${API}/api/user`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: user.id,
      email: user.email
    })
  });
}
