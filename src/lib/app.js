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
  hideTranscript,
  setExpressionFromText
} from "../components/assistantFace.js";

import { checkAuth } from "./supabase.js";
import { signIn, signUp, signOut } from "./auth.js";
import { VoiceActivityDetector } from "./voiceActivityDetection.js";
import { speak, playAudio, sing } from "./textToSpeech.js";
import {
  shouldShowInline,
  extractInlineContent,
  generateSummary,
  showInlineOutput,
  initInlineOutput
} from "./inlineOutput.js";

const API = "https://aibackend-production-a44f.up.railway.app";

window.currentChatId = null;
window.chatCache = [];

// Voice state
let vad = null;
let isListening = false;
let isAISpeaking = false; // Prevent overlapping AI responses

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

  // Initialize face with tap-to-talk handler (starts blinking automatically)
  initAssistantFace(handleFaceTap);

  // Initialize inline output panel
  initInlineOutput();
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

async function openSettings() {
  const panel = document.getElementById("settingsPanel");
  if (panel) {
    panel.classList.remove("hidden");
    // Load both chat list and conversation history
    await renderChatListUI();
    await loadConversationHistory();
  }
}

function closeSettings() {
  const panel = document.getElementById("settingsPanel");
  if (panel) {
    panel.classList.add("hidden");
  }
}

/**
 * Render chat list in settings panel
 */
async function renderChatListUI() {
  const container = document.getElementById("chatListContainer");
  if (!container) return;

  if (!window.chatCache || window.chatCache.length === 0) {
    container.innerHTML = '<p class="no-chats">No chats yet</p>';
    return;
  }

  container.innerHTML = window.chatCache.map(chat => {
    const date = new Date(chat.created_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });

    const isActive = chat.id === window.currentChatId;

    return `
      <div class="chat-item ${isActive ? 'active' : ''}" onclick="switchChat('${chat.id}')">
        <div class="chat-item-title">${escapeHtml(chat.title || 'New Chat')}</div>
        <div class="chat-item-date">${date}</div>
      </div>
    `;
  }).join('');
}

/**
 * Switch to a different chat
 */
window.switchChat = async function(chatId) {
  window.currentChatId = chatId;
  await loadConversationHistory();
  await renderChatListUI();
};

/**
 * Load and display conversation history
 */
async function loadConversationHistory() {
  const container = document.getElementById("historyContainer");
  if (!container || !window.currentChatId) return;

  try {
    const res = await fetch(`${API}/api/chat/${window.currentChatId}`);
    const messages = await res.json();

    if (!messages || messages.length === 0) {
      container.innerHTML = '<p class="no-history">No messages yet. Start talking!</p>';
      return;
    }

    // Render messages
    container.innerHTML = messages.map(msg => {
      const timestamp = new Date(msg.created_at).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });

      return `
        <div class="history-message ${msg.role}">
          <div class="role">${msg.role === 'user' ? 'You' : 'PAL'}</div>
          <div class="content">${escapeHtml(msg.content)}</div>
          <div class="timestamp">${timestamp}</div>
        </div>
      `;
    }).join('');

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;

  } catch (err) {
    console.error('Failed to load conversation history:', err);
    container.innerHTML = '<p class="no-history">Failed to load history.</p>';
  }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
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

  // Refresh UI
  await renderChatListUI();
  await loadConversationHistory();
}

async function sendMessage(text) {
  if (!text || !window.currentChatId) return;

  // Show user's message as transcript
  showTranscript(`You: ${text}`);

  try {
    // Send user message - backend handles AI response automatically
    console.log('Sending message to backend:', text);

    const res = await fetch(`${API}/api/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatId: window.currentChatId,
        role: "user",
        content: text
      })
    });

    console.log('Response status:', res.status);

    if (!res.ok) {
      throw new Error(`Backend error: ${res.status}`);
    }

    const data = await res.json();
    console.log('Backend response:', data);

    const aiResponse = data.content; // Backend returns AI response

    if (!aiResponse) {
      throw new Error('No AI response received');
    }

    // Show AI response as transcript
    showTranscript(`PAL: ${aiResponse}`);

    // Set facial expression based on response sentiment
    const emotion = setExpressionFromText(aiResponse);
    console.log('Detected emotion:', emotion);

    // Check for SONG tag
    const songMatch = aiResponse.match(/\[SONG:\s*(.*?)\s*\|\s*(.*?)\]/s);
    
    if (songMatch) {
      const [_, style, lyrics] = songMatch;
      console.log('Song detected:', style);
      
      showTranscript(`PAL is composing a song: "${style}"...`);
      
      // Call singing API
      await speakResponse(lyrics, true, style);
      return;
    }

    // Check if response should be shown inline (AI "free will")
    if (shouldShowInline(aiResponse)) {
      console.log('AI decided to show inline output');

      // Extract content to display
      const inlineContent = extractInlineContent(aiResponse);

      // Generate voice-friendly summary
      const summary = generateSummary(aiResponse);

      // Show inline panel with content
      showInlineOutput(inlineContent);

      // Speak the summary instead of full response
      showTranscript(`PAL: ${summary}`);
      await speakResponse(summary);
    } else {
      // Normal voice response
      await speakResponse(aiResponse);
    }

    // Hide transcript after speaking
    hideTranscript();

    // Generate chat title after 3rd message
    await maybeGenerateChatTitle();

  } catch (err) {
    console.error('sendMessage error:', err);
    showTranscript(`Error: ${err.message}`);
    setTimeout(() => {
      stopSpeaking(); // Reset to idle
      hideTranscript();
    }, 3000);
  }
}

/**
 * Generate chat title if this is the 3rd message
 */
async function maybeGenerateChatTitle() {
  try {
    // Check if current chat still has default title
    const currentChat = window.chatCache.find(c => c.id === window.currentChatId);
    if (!currentChat || (currentChat.title && currentChat.title !== 'new chat')) {
      return; // Already has a custom title
    }

    // Get message count
    const res = await fetch(`${API}/api/chat/${window.currentChatId}`);
    const messages = await res.json();

    // Generate title after 3rd message (user message #2)
    if (messages.length >= 3) {
      console.log('Generating chat title...');

      const titleRes = await fetch(`${API}/api/chat/generate-title`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: window.currentChatId })
      });

      const { title } = await titleRes.json();
      console.log('Generated title:', title);

      // Update chat cache
      const chatIndex = window.chatCache.findIndex(c => c.id === window.currentChatId);
      if (chatIndex !== -1) {
        window.chatCache[chatIndex].title = title;
      }

      // Refresh chat list if settings panel is open
      const panel = document.getElementById("settingsPanel");
      if (panel && !panel.classList.contains('hidden')) {
        await renderChatListUI();
      }
    }
  } catch (err) {
    console.error('Failed to generate chat title:', err);
    // Non-critical, don't show error to user
  }
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

/* ================= VOICE (PAL-Style: Continuous Listening with VAD) ================= */

/**
 * Handle face tap - toggle listening mode
 */
async function handleFaceTap() {
  if (isListening) {
    // Stop listening mode
    stopListening();
  } else {
    // Start listening mode
    startListening();
  }
}

/**
 * Start continuous listening with VAD
 */
function startListening() {
  if (!vad) {
    // Initialize VAD with callbacks
    vad = new VoiceActivityDetector(
      // onTranscript callback - when user stops speaking
      async (text) => {
        console.log('User said:', text);

        // Ignore if AI is currently speaking (prevent overlapping responses)
        if (isAISpeaking) {
          console.log('AI is speaking, ignoring user input');
          return;
        }

        // Show what user said
        showTranscript(`You: ${text}`);

        // Send to AI
        await sendMessage(text);

        // Stay in listening mode for follow-up
        if (isListening) {
          startRecording(); // Visual indicator we're still listening
        }
      },
      // onError callback
      (error) => {
        console.error('VAD error:', error);
        showTranscript(`Error: ${error}`);
        setTimeout(() => {
          stopListening();
          hideTranscript();
        }, 3000);
      }
    );
  }

  const started = vad.start();

  if (started) {
    isListening = true;
    startRecording(); // Update face animation
    console.log('Started continuous listening mode');
  } else {
    stopSpeaking(); // Reset to idle if failed
  }
}

/**
 * Stop listening mode
 */
function stopListening() {
  if (vad) {
    vad.stop();
  }

  isListening = false;
  stopSpeaking(); // Reset face to idle
  console.log('Stopped listening mode');
}

/**
 * Speak AI response with face animation
 * @param {string} text - Text to speak (or lyrics)
 * @param {boolean} isSinging - Whether to use singing mode
 * @param {string} songStyle - Style description for song generation
 */
async function speakResponse(text, isSinging = false, songStyle = "") {
  try {
    isAISpeaking = true;
    let audioUrl;

    if (isSinging) {
      // Generate song
      const prompt = `${songStyle} ${text}`;
      audioUrl = await sing(prompt);
    } else {
      // Generate speech audio
      audioUrl = await speak(text);
    }

    // Start face animation
    startSpeaking();

    // Play audio with mouth sync
    await playAudio(audioUrl, (amplitude) => {
      updateMouth(amplitude);
    });

    // Stop face animation
    stopSpeaking();
  } catch (err) {
    console.error('Audio generation failed:', err);
    // Don't block the UI if TTS fails
    stopSpeaking();
  } finally {
    isAISpeaking = false;
  }
}
