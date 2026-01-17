/* ================= AUTH UI ================= */

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
    signupForm.classList.remove("hidden");
    signinForm.classList.add("hidden");
    tabs[1]?.classList.add("active");
  }
}

export function updateAuthStatus(msg, type = "") {
  const el = document.getElementById("authStatus");
  if (!el) return;
  el.textContent = msg;
  el.className = `status ${type}`;
}

/* ================= SIDEBAR ================= */

export function toggleSidebar() {
  document.querySelector(".sidebar")?.classList.toggle("open");
}

export function newChat() {
  window.chatMessages = [];
  document.getElementById("messages").innerHTML = "";
}

/* ================= CHAT ================= */

export function handleKeyDown(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSendMessage();
  }
}

export async function handleSendMessage() {
  const input = document.getElementById("userInput");
  const messagesDiv = document.getElementById("messages");

  if (!input.value.trim()) return;

  const userMsg = input.value;
  input.value = "";

  messagesDiv.innerHTML += `<div class="msg user">${userMsg}</div>`;

  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: userMsg }]
    })
  });

  const data = await res.json();

  messagesDiv.innerHTML += `<div class="msg ai">${data.content}</div>`;
}

/* ================= GLOBALS ================= */

window.switchTab = switchTab;
window.toggleSidebar = toggleSidebar;
window.newChat = newChat;
window.handleKeyDown = handleKeyDown;
window.sendMessage = handleSendMessage;
