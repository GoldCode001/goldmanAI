/* ================= AUTH UI ================= */

export function showAuthScreen() {
  document.getElementById("authScreen")?.classList.remove("hidden");
  document.getElementById("mainApp")?.classList.add("hidden");
}

export function showMainApp() {
  document.getElementById("authScreen")?.classList.add("hidden");
  document.getElementById("mainApp")?.classList.remove("hidden");
}

export function updateAuthStatus(msg, type = "info") {
  const el = document.getElementById("authStatus");
  if (!el) return;
  el.textContent = msg;
  el.className = `status ${type}`;
}

export function switchTab(tab) {
  document.getElementById("signinForm")?.classList.toggle("hidden", tab !== "signin");
  document.getElementById("signupForm")?.classList.toggle("hidden", tab !== "signup");
}

/* ================= SIDEBAR ================= */

export function renderChatList(chats, activeId) {
  const list = document.getElementById("historyList");
  if (!list) return;

  list.innerHTML = "";

  chats.forEach(chat => {
    const item = document.createElement("div");
    item.className = "chat-item" + (chat.id === activeId ? " active" : "");
    item.textContent = chat.title || "new chat";

    item.onclick = () => {
      window.loadChatById(chat.id);
    };

    list.appendChild(item);
  });
}

export function toggleSidebar() {
  document.querySelector(".sidebar")?.classList.toggle("collapsed");
}

/* ================= CHAT UI ================= */

export function renderMessages(messages) {
  const container = document.getElementById("messages");
  if (!container) return;

  container.innerHTML = "";

  messages.forEach(m => {
    const div = document.createElement("div");
    div.className = `message ${m.role}`;
    div.textContent = m.content;
    container.appendChild(div);
  });

  container.scrollTop = container.scrollHeight;
}

export function clearChatUI() {
  const container = document.getElementById("messages");
  if (container) container.innerHTML = "";
}

/* ================= INPUT ================= */

export function handleKeyDown(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    document.getElementById("sendBtn")?.click();
  }
}
