/* ---------- AUTH UI ---------- */

export function showAuthScreen() {
  document.getElementById("authScreen")?.classList.remove("hidden");
  document.getElementById("app")?.classList.add("hidden");
}

export function showMainApp() {
  document.getElementById("authScreen")?.classList.add("hidden");
  document.getElementById("app")?.classList.remove("hidden");
}

export function updateAuthStatus(message, type = "info") {
  const el = document.getElementById("authStatus");
  if (!el) return;

  el.textContent = message;
  el.className = `auth-status ${type}`;
}

export function switchTab(tab) {
  const signin = document.getElementById("signin");
  const signup = document.getElementById("signup");

  if (!signin || !signup) return;

  signin.classList.toggle("hidden", tab !== "signin");
  signup.classList.toggle("hidden", tab !== "signup");
}

/* ---------- SIDEBAR ---------- */

export function toggleSidebar() {
  document.getElementById("sidebar")?.classList.toggle("collapsed");
}

export function newChat() {
  const messages = document.getElementById("messages");
  if (messages) messages.innerHTML = "";
}

/* ---------- CHAT ---------- */

function appendMessage(role, text) {
  const messages = document.getElementById("messages");
  if (!messages) return;

  const msg = document.createElement("div");
  msg.className = `message ${role}`;
  msg.textContent = text;

  messages.appendChild(msg);
  messages.scrollTop = messages.scrollHeight;
}

export async function handleSendMessage() {
  const input = document.getElementById("userInput");
  if (!input) return;

  const text = input.value.trim();
  if (!text) return;

  input.value = "";
  appendMessage("user", text);

  try {
    const res = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text })
    });

    const data = await res.json();
    appendMessage("assistant", data.reply || "no response");
  } catch (err) {
    appendMessage("assistant", "error sending message");
    console.error(err);
  }
}

/* ---------- KEYBOARD ---------- */

export function handleKeyDown(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSendMessage();
  }
}
