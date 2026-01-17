// UI interactions

/* ---------- AUTH UI ---------- */

export function showAuthScreen() {
  document.getElementById("authScreen")?.classList.remove("hidden");
  document.getElementById("mainApp")?.classList.add("hidden");
}

export function showMainApp() {
  document.getElementById("authScreen")?.classList.add("hidden");
  document.getElementById("mainApp")?.classList.remove("hidden");
}

export function switchTab(tab) {
  const signinForm = document.getElementById("signinForm");
  const signupForm = document.getElementById("signupForm");
  const tabs = document.querySelectorAll(".auth-tab");

  tabs.forEach(t => t.classList.remove("active"));

  if (tab === "signin") {
    signinForm.classList.remove("hidden");
    signupForm.classList.add("hidden");
    tabs[0]?.classList.add("active");
  } else {
    signinForm.classList.add("hidden");
    signupForm.classList.remove("hidden");
    tabs[1]?.classList.add("active");
  }
}

export function updateAuthStatus(message, type = "") {
  const status = document.getElementById("authStatus");
  if (!status) return;
  status.textContent = message;
  status.className = "status " + type;
}

/* ---------- APP UI ---------- */

export function updateStatus(message, type = "") {
  const status = document.getElementById("status");
  if (!status) return;
  status.textContent = message;
  status.className = "status " + type;
}

export function toggleSidebar() {
  document.querySelector(".sidebar")?.classList.toggle("open");
}

export async function loadUserData() {
  if (!window.currentUser) return;

  document.getElementById("userEmail").textContent = window.currentUser.email;

  if (typeof loadUserChats === "function") {
    await loadUserChats();
  }
}

/* ---------- CHAT ACTIONS ---------- */

export async function newChat() {
  window.currentChatId = null;
  window.chatMessages = [];

  const messagesDiv = document.getElementById("messages");
  messagesDiv.innerHTML = `
    <div class="welcome-message">
      <div class="welcome-icon">🤖</div>
      <h2>new chat started</h2>
      <p>what can i help you with?</p>
    </div>
  `;

  document.getElementById("chatTitle").textContent = "new chat";
  document.getElementById("chatSubtitle").textContent = "start a conversation";

  updateStatus("new chat created", "success");
}

export async function deleteCurrentChat() {
  if (!window.currentChatId) return;

  if (!confirm("delete this chat? this cannot be undone.")) return;

  if (typeof deleteChat !== "function") return;

  const success = await deleteChat(window.currentChatId);

  if (success) {
    updateStatus("chat deleted", "success");
    await newChat();
  } else {
    updateStatus("failed to delete chat", "error");
  }
}

/* ---------- EXPORT ---------- */

export async function exportAllChats() {
  if (typeof loadChats !== "function") return;

  const chats = await loadChats();
  const exportData = [];

  for (const chat of chats) {
    const messages = typeof loadMessages === "function"
      ? await loadMessages(chat.id)
      : [];
    exportData.push({ ...chat, messages });
  }

  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: "application/json"
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ai-assistant-export-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);

  updateStatus("chats exported", "success");
}

export function handleKeyDown(event) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    if (typeof sendMessage === "function") {
      sendMessage();
    }
  }
}


/* ---------- GLOBALS FOR HTML ---------- */

window.switchTab = switchTab;
window.toggleSidebar = toggleSidebar;
window.newChat = newChat;
window.deleteCurrentChat = deleteCurrentChat;
window.exportAllChats = exportAllChats;
window.handlekeyDown = handleKeyDown;