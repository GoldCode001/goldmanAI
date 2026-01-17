/* ================= UI CORE ================= */

export function showAuthScreen() {
  document.getElementById("authScreen")?.classList.remove("hidden");
  document.getElementById("mainApp")?.classList.add("hidden");
}

export function showMainApp() {
  document.getElementById("authScreen")?.classList.add("hidden");
  document.getElementById("mainApp")?.classList.remove("hidden");
}

export function switchTab(tab) {
  document.getElementById("signinForm")?.classList.toggle("hidden", tab !== "signin");
  document.getElementById("signupForm")?.classList.toggle("hidden", tab !== "signup");
}

export function toggleSidebar() {
  document.querySelector(".sidebar")?.classList.toggle("open");
}

export function newChat() {
  window.chatMessages = [];
  renderMessages([]);
}

/* ================= CHAT ================= */

window.chatMessages = [];

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

export async function handleSendMessage() {
  const input = document.getElementById("userInput");
  if (!input) return;

  const text = input.value.trim();
  if (!text) return;

  input.value = "";

  window.chatMessages.push({ role: "user", content: text });
  renderMessages(window.chatMessages);

  try {
    const res = await fetch(
      "https://aibackend-production-a44f.up.railway.app/api/chat",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: window.chatMessages })
      }
    );

    const data = await res.json();

    window.chatMessages.push({
      role: "assistant",
      content: data.content || "(empty response)"
    });

    renderMessages(window.chatMessages);
  } catch {
    window.chatMessages.push({
      role: "assistant",
      content: "AI backend error"
    });
    renderMessages(window.chatMessages);
  }
}

export function handleKeyDown(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSendMessage();
  }
}
