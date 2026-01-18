/* ---------- AUTH UI ---------- */

export function showAuthScreen() {
  document.getElementById("authScreen")?.classList.remove("hidden");
  document.getElementById("mainApp")?.classList.add("hidden");
}

export function showMainApp() {
  document.getElementById("authScreen")?.classList.add("hidden");
  document.getElementById("mainApp")?.classList.remove("hidden");
}

export function updateAuthStatus(message, type = "info") {
  const el = document.getElementById("authStatus");
  if (!el) return;

  el.textContent = message;
  el.className = `status ${type}`;
}

export function switchTab(tab) {
  const signinForm = document.getElementById("signinForm");
  const signupForm = document.getElementById("signupForm");

  if (!signinForm || !signupForm) return;

  signinForm.classList.toggle("hidden", tab !== "signin");
  signupForm.classList.toggle("hidden", tab !== "signup");
}

/* ---------- SIDEBAR ---------- */

export function toggleSidebar() {
  document.querySelector(".sidebar")?.classList.toggle("collapsed");
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
    const res = await fetch("https://aibackend-production-a44f.up.railway.app/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: text }]
      })
    });

    if (!res.ok) {
      throw new Error("api error");
    }

    const data = await res.json();
    appendMessage("assistant", data.content || "no response");
  } catch (err) {
    console.error(err);
    appendMessage("assistant", "error contacting server");
  }
}

/* ---------- KEYBOARD ---------- */

export function handleKeyDown(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSendMessage();
  }
}
