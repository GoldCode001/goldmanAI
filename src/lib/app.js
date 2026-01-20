console.log("APP JS LOADED");

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

import { initAssistantFace, startSpeaking, stopSpeaking, updateMouth } from "../components/assistantFace.js";
import { checkAuth } from "./supabase.js";
import { signIn, signUp, signOut } from "./auth.js";
import { AudioRecorder } from "./audioRecorder.js";
import { transcribeAudio } from "./speechToText.js";
import { speak, playAudio } from "./textToSpeech.js";

const API = "https://aibackend-production-a44f.up.railway.app";

window.currentChatId = null;
window.chatCache = [];

// Voice state
let audioRecorder = null;
let isRecording = false;

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

  document.getElementById("sendBtn")?.addEventListener("click", () => sendMessage());
  document.getElementById("userInput")?.addEventListener("keydown", handleKeyDown);

  document.getElementById("newChatBtn")?.addEventListener("click", createNewChat);
  document.getElementById("signOutBtn")?.addEventListener("click", signOut);
  document.getElementById("toggleSidebarBtn")?.addEventListener("click", toggleSidebar);

  // Voice button
  document.getElementById("voiceBtn")?.addEventListener("click", toggleVoiceRecording);
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

async function sendMessage(textOverride = null) {
  const input = document.getElementById("userInput");
  const text = textOverride || input.value.trim();
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
  const aiResponse = aiData.content;

  await fetch(`${API}/api/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chatId: window.currentChatId,
      role: "assistant",
      content: aiResponse
    })
  });

  // Speak the AI response
  await speakResponse(aiResponse);

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

/* ================= VOICE ================= */

/**
 * Toggle voice recording on/off
 */
async function toggleVoiceRecording() {
  if (!audioRecorder) {
    audioRecorder = new AudioRecorder();
    await audioRecorder.init();
  }

  if (isRecording) {
    // Stop recording and transcribe
    const audioBlob = await audioRecorder.stopRecording();
    isRecording = false;
    updateVoiceButton(false);

    // Show loading state
    const input = document.getElementById("userInput");
    input.placeholder = "Transcribing...";

    try {
      // Transcribe audio
      const text = await transcribeAudio(audioBlob);

      if (text) {
        // Send transcribed message
        await sendMessage(text);
      }
    } catch (err) {
      console.error('Voice recording failed:', err);
      alert('Voice transcription failed. Please try again.');
    } finally {
      input.placeholder = "ask something...";
    }
  } else {
    // Start recording
    audioRecorder.startRecording();
    isRecording = true;
    updateVoiceButton(true);
  }
}

/**
 * Update voice button UI state
 */
function updateVoiceButton(recording) {
  const btn = document.getElementById("voiceBtn");
  if (!btn) return;

  btn.textContent = recording ? "⏹️" : "🎤";
  btn.classList.toggle("recording", recording);
  btn.title = recording ? "Stop recording" : "Start voice recording";
}

/**
 * Speak AI response with face animation
 */
async function speakResponse(text) {
  try {
    // Generate speech audio
    const audioUrl = await speak(text);

    // Start face animation
    startSpeaking();

    // Play audio with mouth sync
    await playAudio(audioUrl, (amplitude) => {
      updateMouth(amplitude);
    });

    // Stop face animation
    stopSpeaking();
  } catch (err) {
    console.error('TTS failed:', err);
    // Don't block the UI if TTS fails
    stopSpeaking();
  }
}
