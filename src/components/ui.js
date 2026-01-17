export let chatMessages = [];

export function showAuthScreen() {
  authScreen.classList.remove("hidden");
  mainApp.classList.add("hidden");
}

export function showMainApp() {
  authScreen.classList.add("hidden");
  mainApp.classList.remove("hidden");
  if (window.currentUser) {
    userEmail.textContent = window.currentUser.email;
  }
}

export function switchTab(tab) {
  signinForm.classList.toggle("hidden", tab !== "signin");
  signupForm.classList.toggle("hidden", tab !== "signup");

  signinTab.classList.toggle("active", tab === "signin");
  signupTab.classList.toggle("active", tab === "signup");
}

export function resetChat() {
  chatMessages = [];
  messages.innerHTML = "";
}

export async function handleSendMessage() {
  const text = userInput.value.trim();
  if (!text) return;

  userInput.value = "";

  chatMessages.push({ role: "user", content: text });
  render();

  const res = await fetch(
    "https://aibackend-production-a44f.up.railway.app/api/chat",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: chatMessages })
    }
  );

  const data = await res.json();
  chatMessages.push({ role: "assistant", content: data.content || "" });
  render();
}

function render() {
  messages.innerHTML = "";
  for (const m of chatMessages) {
    const div = document.createElement("div");
    div.className = `message ${m.role}`;
    div.textContent = m.content;
    messages.appendChild(div);
  }
  messages.scrollTop = messages.scrollHeight;
}
