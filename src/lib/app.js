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

import {
  initAssistantFace,
  startSpeaking,
  stopSpeaking,
  updateMouth,
  startRecording,
  stopRecording,
  showTranscript,
  hideTranscript
} from "../components/assistantFace.js";

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

  // Initialize face with tap-to-talk handler
  initAssistantFace(handleFaceTap);
});

/* ================= EVENTS ================= */

function bindEvents() {
  document.getElementById("signinForm")?.addEventListener("submit", onSignIn);
  document.getElementById("signupForm")?.addEventListener("submit", onSignUp);

  document.getElementById("newChatBtn")?.addEventListener("click", createNewChat);
  document.getElementById("signOutBtn")?.addEventListener("click", signOut);

  // Settings panel
  document.getElementById("settingsBtn")?.addEventListener("click", openSettings);
  document.getElementById("closeSettings")?.addEventListener("click", closeSettings);
}

/* ================= SETTINGS ================= */

function openSettings() {
  const panel = document.getElementById("settingsPanel");
  if (panel) {
    panel.classList.remove("hidden");
  }
}

function closeSettings() {
  const panel = document.getElementById("settingsPanel");
  if (panel) {
    panel.classList.add("hidden");
  }
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

async function sendMessage(text) {
  if (!text || !window.currentChatId) return;

  // Show user's message as transcript
  showTranscript(`You: ${text}`);

  // Send user message - backend handles AI response automatically
  const res = await fetch(`${API}/api/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chatId: window.currentChatId,
      role: "user",
      content: text
    })
  });

  const data = await res.json();
  const aiResponse = data.content; // Backend returns AI response

  // Show AI response as transcript
  showTranscript(`PAL: ${aiResponse}`);

  // Speak the AI response
  await speakResponse(aiResponse);

  // Hide transcript after speaking
  hideTranscript();
}

/* ================= USER ================= */

async function ensureUser(user) {
  window.currentUser = user;

  // Update email display
  const emailEl = document.getElementById("userEmail");
  if (emailEl) {
    emailEl.textContent = user.email;
  }

  await fetch(`${API}/api/user`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: user.id,
      email: user.email
    })
  });
}

/* ================= VOICE (PAL-Style: Tap to Talk) ================= */

/**
 * Handle face tap - toggle recording
 */
async function handleFaceTap() {
  if (!audioRecorder) {
    audioRecorder = new AudioRecorder();
    await audioRecorder.init();
  }

  if (isRecording) {
    // Stop recording and process
    await stopVoiceRecording();
  } else {
    // Start recording
    startVoiceRecording();
  }
}

/**
 * Start voice recording
 */
function startVoiceRecording() {
  if (!audioRecorder) return;

  audioRecorder.startRecording();
  isRecording = true;
  startRecording(); // Update face animation
}

/**
 * Stop voice recording and transcribe
 */
async function stopVoiceRecording() {
  if (!audioRecorder) return;

  const audioBlob = await audioRecorder.stopRecording();
  isRecording = false;
  stopRecording(); // Update face animation

  try {
    // Transcribe audio
    const text = await transcribeAudio(audioBlob);

    if (text) {
      // Send transcribed message
      await sendMessage(text);
    } else {
      // No transcription, reset to idle
      stopSpeaking();
    }
  } catch (err) {
    console.error('Voice recording failed:', err);
    stopSpeaking(); // Reset to idle on error
  }
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
