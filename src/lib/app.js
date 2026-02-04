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
  initCanvasFace,
  updateFaceState,
  destroyCanvasFace
} from "../components/canvasFace.js";

import {
  initChatOverlay,
  updateConnectionState,
  updateMessages,
  showChatOverlay,
  hideChatOverlay
} from "../components/chatOverlay.js";

// Legacy face functions (for compatibility)
import {
  showTranscript,
  hideTranscript,
  setExpressionFromText
} from "../components/assistantFace.js";

import { checkAuth } from "./supabase.js";
import { signIn, signUp, signOut } from "./auth.js";
import { encryptMessage, decryptMessage } from "./encryption.js";
import { initVoiceAgent, startVoiceAgent, stopVoiceAgent, isVoiceAgentActive } from "./voice/voiceAgent.js";
import {
  shouldShowInline,
  extractInlineContent,
  generateSummary,
  showInlineOutput,
  initInlineOutput
} from "./inlineOutput.js";
import { learnFromConversation, getUserMemory } from "./memory.js";
import { showOnboarding } from "../components/onboarding.js";
import { initWakeWord, startWakeWordListening, stopWakeWordListening, setWakePhrase } from "./wakeWord.js";
import { initProactiveReminders, getProactiveContext } from "./proactiveReminders.js";
import { setAIDecisionCallback, refreshAgentStatus, setDesktopAgentAvailable } from "./tools.js";
import * as DesktopAgent from "./desktopAgent.js";

const API = "https://aibackend-production-a44f.up.railway.app";

window.currentChatId = null;
window.chatCache = [];

// Bubble window communication (Tauri only)
let isTauriApp = false;
let tauriInvoke = null;
let tauriEmit = null;

// Check if running in Tauri
(async () => {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const { emit } = await import('@tauri-apps/api/event');
    tauriInvoke = invoke;
    tauriEmit = emit;
    isTauriApp = true;
    console.log('[Bubble] Running in Tauri mode');
  } catch (err) {
    console.log('[Bubble] Running in web mode');
  }
})();

// Notify bubble window of status changes
async function notifyBubble(type, data) {
  if (!isTauriApp || !tauriEmit) return;

  try {
    // Emit event to bubble window
    await tauriEmit('bubble-update', { type, data });
    console.log('[Bubble] Notify:', type, data);
  } catch (err) {
    console.error('[Bubble] Failed to notify:', err);
  }
}

// Voice state
let isListening = false;
let isAISpeaking = false; // Track if AI is speaking
let currentMood = 'NEUTRAL'; // For canvas face
let currentAudioLevel = 0; // Current audio amplitude for face animation

/* ================= BOOT ================= */

document.addEventListener("DOMContentLoaded", async () => {
  // Bind auth events FIRST (so they work on auth screen before login)
  bindAuthEvents();

  const user = await checkAuth();

  if (!user) {
    showAuthScreen();
    return;
  }

  showMainApp();
  await ensureUser(user);
  await loadChats(user.id);
  bindAppEvents();

  // Initialize new canvas-based face and chat overlay
  initCanvasFace();
  initChatOverlay();

  // Setup activate/disconnect handlers
  window.onActivatePal = handleFaceTap;
  window.onDisconnectPal = () => {
    stopListening();
  };

  // Initialize inline output panel
  initInlineOutput();

  // Show onboarding for new users (requests permissions)
  showOnboarding();

  // Initialize wake word detection
  initWakeWordDetection();

  // Initialize proactive reminders
  initProactiveReminders((reminder) => {
    console.log('[App] Reminder due:', reminder.message);
    // If PAL is active, let it announce the reminder
    if (isListening && window.onTranscriptUpdate) {
      // PAL will naturally handle this via the reminder event
    }
  });

  // Initialize autonomous agent (Android + Desktop)
  await initAutonomousAgent();

  // Initialize Voice Agent
  const cartesiaKey = localStorage.getItem('cartesia_api_key') || 'sk_car_XUcbJyqXMv1dHrvJSSA6yr';
  const deepgramKey = localStorage.getItem('deepgram_api_key') || '2b59d42eb56f29b5c3252f012d99d71500952d8a';

  await initVoiceAgent({
    deepgramApiKey: deepgramKey,
    cartesiaApiKey: cartesiaKey,
    onUserTranscript: (transcript, isFinal) => {
      if (isFinal) {
        showTranscript(`You: ${transcript}`);
      }
    },
    onAIResponse: (content) => {
      // Update face state or other UI elements if needed
      isAISpeaking = true;
      updateFaceState('HAPPY', 0.5, true);
    }
  });
});

/**
 * Initialize the autonomous agent for device control
 */
async function initAutonomousAgent() {
  // Check if agent is available (Android with accessibility enabled)
  const agentEnabled = await refreshAgentStatus();
  console.log('[App] Android agent available:', agentEnabled);

  // Initialize desktop agent if running in Tauri
  const desktopEnabled = await DesktopAgent.initDesktopAgent();
  if (desktopEnabled) {
    setDesktopAgentAvailable(true);
    const platformInfo = DesktopAgent.getPlatformInfo();
    console.log('[App] Desktop agent available on:', platformInfo);
  } else {
    console.log('[App] Desktop agent not available (not running in Tauri)');
  }

  // Set up AI decision callback for autonomous tasks
  setAIDecisionCallback(async (prompt) => {
    try {
      // Get Gemini API key
      const keyRes = await fetch(`${API}/api/gemini/key`);
      if (!keyRes.ok) {
        throw new Error('Failed to get Gemini API key');
      }
      const { apiKey } = await keyRes.json();

      // Import Gemini SDK
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });

      // Make a text-based query to Gemini for the autonomous decision
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt
      });

      const text = response.text || '';
      console.log('[Agent] AI decision:', text);
      return text;
    } catch (e) {
      console.error('[Agent] AI decision error:', e);
      return 'GOAL FAILED: Could not get AI decision';
    }
  });

  // Listen for Android agent events
  window.addEventListener('pal-agent-step', (e) => {
    const { step, action, goal } = e.detail;
    console.log(`[Agent] Android Step ${step}: ${action?.type || 'unknown'}`);
    // Could show a small indicator in the UI
  });

  window.addEventListener('pal-agent-complete', (e) => {
    const { success, message, error, steps } = e.detail;
    if (success) {
      console.log(`[Agent] Android task completed in ${steps} steps: ${message}`);
    } else {
      console.log(`[Agent] Android task failed after ${steps} steps: ${error}`);
    }
  });

  // Listen for Desktop agent events
  window.addEventListener('pal-desktop-step', (e) => {
    const { step, decision, goal } = e.detail;
    console.log(`[Agent] Desktop Step ${step}: ${decision}`);
  });

  window.addEventListener('pal-desktop-complete', (e) => {
    const { success, message, error, steps } = e.detail;
    if (success) {
      console.log(`[Agent] Desktop task completed in ${steps} steps: ${message}`);
    } else {
      console.log(`[Agent] Desktop task failed: ${error}`);
    }
  });
}

/* ================= EVENTS ================= */

/**
 * Bind auth-related events (must run BEFORE user check)
 */
function bindAuthEvents() {
  document.getElementById("signinForm")?.addEventListener("submit", onSignIn);
  document.getElementById("signupForm")?.addEventListener("submit", onSignUp);
  document.getElementById("signinTab")?.addEventListener("click", () => switchTab("signin"));
  document.getElementById("signupTab")?.addEventListener("click", () => switchTab("signup"));
}

/**
 * Bind app events (runs AFTER successful auth)
 */
function bindAppEvents() {
  document.getElementById("newChatBtn")?.addEventListener("click", createNewChat);
  document.getElementById("signOutBtn")?.addEventListener("click", signOut);

  // Settings panel
  document.getElementById("settingsBtn")?.addEventListener("click", openSettings);
  document.getElementById("closeSettings")?.addEventListener("click", closeSettings);

  // Minimize to bubble (Tauri only)
  const minimizeBubbleBtn = document.getElementById("minimizeBubbleBtn");
  if (minimizeBubbleBtn) {
    minimizeBubbleBtn.addEventListener("click", async () => {
      if (tauriInvoke) {
        try {
          await tauriInvoke('minimize_to_bubble');
        } catch (err) {
          console.error('Failed to minimize to bubble:', err);
        }
      }
    });

    // Show button only in Tauri
    if (isTauriApp) {
      minimizeBubbleBtn.style.display = 'flex';
    }
  }

  // AI Name save handler
  document.getElementById("saveAiNameBtn")?.addEventListener("click", async () => {
    const aiNameInput = document.getElementById('aiNameInput');
    if (!aiNameInput) return;

    const aiName = aiNameInput.value.trim();
    if (!aiName) {
      alert('Please enter an AI name');
      return;
    }

    const { getUserMemory, saveUserMemory } = await import('./memory.js');
    const memory = await getUserMemory() || {};
    memory.aiName = aiName;

    const saved = await saveUserMemory(memory);
    if (saved) {
      // Update wake word to use new AI name
      setWakePhrase(aiName);
      alert(`AI name saved! Wake word is now "Hey ${aiName}"`);
    } else {
      alert('Failed to save AI name');
    }
  });
}

/* ================= SETTINGS ================= */

async function openSettings() {
  const panel = document.getElementById("settingsPanel");
  if (panel) {
    panel.classList.remove("hidden");
    // Load both chat list and conversation history
    await renderChatListUI();
    await loadConversationHistory();

    // Load user memory and populate AI name field
    const { getUserMemory } = await import('./memory.js');
    const memory = await getUserMemory();
    const aiNameInput = document.getElementById('aiNameInput');
    if (aiNameInput && memory?.aiName) {
      aiNameInput.value = memory.aiName;
    }
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
window.switchChat = async function (chatId) {
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

    // Decrypt messages if needed
    const processedMessages = await Promise.all(messages.map(async msg => {
      let content = msg.content;
      // Check if message looks encrypted (Base64) and we have a key
      // Simple heuristic: no spaces, ends with =, long string
      // Or just try decrypting if we are in crypto mode
      if (window.currentUser?.isCrypto && window.sessionKey) {
        // We assume all messages in this mode are encrypted or we try to decrypt
        // If decryption fails, it returns the original or error text
        const decrypted = await decryptMessage(content, window.sessionKey);
        if (decrypted && decrypted !== '[Encrypted Message]') {
          content = decrypted;
        }
      }
      return { ...msg, content };
    }));

    // Get AI name for display (once, outside the map)
    const memory = await getUserMemory() || {};
    const aiName = memory.aiName || 'PAL';

    // Render messages
    container.innerHTML = processedMessages.map(msg => {
      const timestamp = new Date(msg.created_at).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });

      return `
        <div class="history-message ${msg.role}">
          <div class="role">${msg.role === 'user' ? 'You' : aiName}</div>
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
  const email = document.getElementById('signinEmail').value;
  const password = document.getElementById('signinPassword').value;

  try {
    await signIn(email, password);
    location.reload();
  } catch (err) {
    updateAuthStatus(err.message, "error");
  }
}

async function onSignUp(e) {
  e.preventDefault();
  const name = document.getElementById('signupName').value.trim();
  const email = document.getElementById('signupEmail').value;
  const password = document.getElementById('signupPassword').value;
  const confirm = document.getElementById('signupConfirm').value;

  if (!name) {
    updateAuthStatus("Please enter your name", "error");
    return;
  }

  if (password !== confirm) {
    updateAuthStatus("passwords do not match", "error");
    return;
  }

  try {
    const user = await signUp(email, password);

    // Store user's name in memory
    if (user && user.id) {
      const { saveUserMemory } = await import('./memory.js');
      await saveUserMemory({ name: name });
    }

    updateAuthStatus("Account created! Please sign in.", "success");
    switchTab("signin");
  } catch (err) {
    updateAuthStatus(err.message, "error");
  }
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

/**
 * Load and decrypt conversation history for AI context
 * Returns plain text messages that backend can use for AI context
 */
async function getDecryptedHistory(chatId) {
  try {
    const res = await fetch(`${API}/api/chat/${chatId}`);
    const messages = await res.json();

    if (!messages || messages.length === 0) {
      return [];
    }

    // Decrypt messages if needed for AI context
    const decryptedHistory = await Promise.all(messages.map(async msg => {
      let content = msg.content;

      // If we're in crypto mode, try to decrypt
      if (window.currentUser?.isCrypto && window.sessionKey) {
        const decrypted = await decryptMessage(content, window.sessionKey);
        if (decrypted && decrypted !== '[Encrypted Message]') {
          content = decrypted;
        }
      }

      return {
        role: msg.role,
        content: content // Plain text for AI context
      };
    }));

    return decryptedHistory;
  } catch (err) {
    console.error('Failed to load decrypted history:', err);
    return []; // Return empty array on error
  }
}

async function sendMessage(text) {
  if (!text || !window.currentChatId) return;

  // Show user's message as transcript
  showTranscript(`You: ${text}`);

  try {
    // Send user message - backend handles AI response automatically
    console.log('Sending message to backend:', text);

    // Load and decrypt conversation history for AI context
    const decryptedHistory = await getDecryptedHistory(window.currentChatId);
    console.log('Sending decrypted history for AI context:', decryptedHistory.length, 'messages');

    let encryptedContent = null;
    if (window.currentUser?.isCrypto && window.sessionKey) {
      encryptedContent = await encryptMessage(text, window.sessionKey);
    }

    // Get user language preference
    const userSettings = await getUserMemory();
    const userLanguage = userSettings?.language || "en";

    const res = await fetch(`${API}/api/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatId: window.currentChatId,
        role: "user",
        content: text, // Plain text for AI context
        encryptedContent: encryptedContent, // Encrypted for storage
        decryptedHistory: decryptedHistory, // Send decrypted history for AI context
        userId: window.currentUser?.id, // For memory/personalization
        language: userLanguage // For multi-language support
      })
    });

    console.log('Response status:', res.status);

    if (!res.ok) {
      throw new Error(`Backend error: ${res.status}`);
    }

    const data = await res.json();
    console.log('Backend response:', data);

    let aiResponse = data.content; // Backend returns AI response
    const responseLanguage = data.language || userLanguage; // Get language from response or use user preference

    // If backend returned encrypted response (future proofing), decrypt it
    if (data.encryptedContent && window.currentUser?.isCrypto && window.sessionKey) {
      const decrypted = await decryptMessage(data.encryptedContent, window.sessionKey);
      if (decrypted) aiResponse = decrypted;
    }

    if (!aiResponse) {
      throw new Error('No AI response received');
    }

    // Show AI response as transcript
    const memory = await getUserMemory() || {};
    const aiName = memory.aiName || 'PAL';
    showTranscript(`${aiName}: ${aiResponse}`);

    // Set facial expression based on response sentiment
    const emotion = setExpressionFromText(aiResponse);
    console.log('Detected emotion:', emotion);

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
      const aiNameForSummary = (await getUserMemory())?.aiName || 'PAL';
      showTranscript(`${aiNameForSummary}: ${summary}`);
      await speakResponse(summary, responseLanguage);
    } else {
      // Normal voice response
      await speakResponse(aiResponse, responseLanguage);
    }

    // Hide transcript after speaking
    hideTranscript();

    // Learn from conversation for personalization
    try {
      const allMessages = [...decryptedHistory,
      { role: "user", content: text },
      { role: "assistant", content: aiResponse }
      ];
      await learnFromConversation(allMessages);
    } catch (err) {
      console.error('Failed to learn from conversation:', err);
      // Non-critical, continue
    }

    // Generate chat title after 3rd message
    await maybeGenerateChatTitle();

  } catch (err) {
    console.error('sendMessage error:', err);
    showTranscript(`Error: ${err.message}`);
    setTimeout(() => {
      // stopSpeaking(); // Function doesn't exist - removed
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

/* ================= WAKE WORD ================= */

/**
 * Initialize wake word detection ("Hey PAL")
 */
async function initWakeWordDetection() {
  // Get user's custom AI name if set
  const memory = await getUserMemory() || {};
  const aiName = memory.aiName || 'PAL';

  // Initialize wake word with custom phrase
  const initialized = initWakeWord({
    customPhrase: `hey ${aiName.toLowerCase()}`,
    onDetected: async (transcript) => {
      console.log('[WakeWord] Wake phrase detected:', transcript);

      // Activate PAL
      if (!isListening) {
        await startListening();
      }
    }
  });

  if (initialized) {
    // Start listening for wake word
    startWakeWordListening();
    console.log('[WakeWord] Now listening for "Hey ' + aiName + '"');
  }
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
 * Start listening mode using Deepgram + Cartesia pipeline
 */
async function startListening() {
  try {
    // Stop wake word listening while PAL is active
    stopWakeWordListening();

    // Start Voice Agent
    await startVoiceAgent();

    isListening = true;
    updateConnectionState(true); // Update chat overlay
    updateFaceState('NEUTRAL', 0, true); // Update canvas face
    notifyBubble('listening', { listening: true }); // Notify bubble
    notifyBubble('status', { status: 'active' }); // Update status dot
    console.log('[App] Voice agent started');

  } catch (err) {
    console.error('Failed to start listening:', err);
    showTranscript(`Error: ${err.message}`);
    startWakeWordListening(); // Resume wake word if failed
  }
}

/**
 * Stop listening mode
 */
function stopListening() {
  stopVoiceAgent();
  isListening = false;
  updateConnectionState(false); // Update chat overlay
  updateFaceState('NEUTRAL', 0, false); // Reset canvas face
  notifyBubble('listening', { listening: false }); // Notify bubble
  notifyBubble('status', { status: 'standby' }); // Update status dot
  console.log('[App] Stopped listening');

  // Resume wake word listening
  startWakeWordListening();
}
