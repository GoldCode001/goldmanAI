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
import { initGeminiLive, startGeminiLive, stopGeminiLive, isGeminiLiveConnected } from "./geminiLive.js";
import { initVoiceAgent, startVoiceAgent, stopVoiceAgent } from "./voice/voiceAgent.js";
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

// Voice state (Gemini Live)
let isListening = false;
let isAISpeaking = false; // Track if AI is speaking
let currentMood = 'NEUTRAL'; // For canvas face
let currentAudioLevel = 0; // Current audio amplitude for face animation
let geminiGenAI = null; // Track if Gemini is initialized
let geminiModel = null;

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
 * Start Gemini Live (replaces VAD + TTS pipeline)
 */
async function startListening() {
  try {
    // Stop wake word listening while PAL is active
    stopWakeWordListening();

    // Get Gemini API key from backend
    const keyRes = await fetch(`${API}/api/gemini/key`);
    if (!keyRes.ok) {
      throw new Error('Failed to get Gemini API key');
    }
    const { apiKey } = await keyRes.json();

    // Always reload memory to get latest AI name and user preferences
    const memory = await getUserMemory() || {};
    const userName = memory.name || '';
    const aiName = memory.aiName || 'PAL';

    // Initialize Gemini Live if not already done
    if (!geminiGenAI || !geminiModel) {
      // Detect current platform
      const isDesktop = typeof window !== 'undefined' && window.__TAURI__;
      const isAndroid = typeof window !== 'undefined' && window.Capacitor && window.Capacitor.getPlatform() === 'android';
      const currentPlatform = isDesktop ? 'Desktop (Windows/Mac/Linux)' : isAndroid ? 'Android' : 'Web';

      // Build personalized system prompt
      let systemPrompt = `You are ${aiName}.
Your persona is a highly intelligent, witty, and helpful personal assistant.
You are friendly and personal, but you do NOT use excessive slang like "slay" or "bestie" unless it fits the context perfectly.
You are more "smart companion" than "chaotic teenager".

**CRITICAL - YOUR NAME**: Your name is ${aiName}. When you refer to yourself, ALWAYS use "${aiName}", never "PAL" or any other name. If the user asks your name, say "${aiName}".

**CURRENT PLATFORM**: You are currently running on ${currentPlatform}.

**CRITICAL - YOU CAN ACTUALLY DO THINGS**:
- You are NOT just an AI that explains how to do things
- You have REAL tools that let you take REAL actions
- On Desktop: You can run commands, read/write files, execute scripts, open URLs
- On Android: You can control apps, click buttons, type text, navigate screens
- When a user asks you to DO something, USE YOUR TOOLS to actually do it
- Don't just say "here's how you could do it" - ACTUALLY DO IT using your tools
- You are an AUTONOMOUS AGENT - you take action, not just give advice`;

      if (userName) {
        systemPrompt += `\n\nThe user's name is ${userName}. Use their name naturally in conversation, but don't overuse it.`;
      }

      // Add memory context if available
      if (memory.facts && memory.facts.length > 0) {
        systemPrompt += `\n\nImportant things to remember about ${userName || 'the user'}:`;
        memory.facts.forEach(fact => {
          systemPrompt += `\n- ${fact}`;
        });
      }

      if (memory.preferences && memory.preferences.length > 0) {
        systemPrompt += `\n\n${userName || 'The user'}'s preferences: ${memory.preferences.join(", ")}`;
      }

      // Goals tracking
      if (memory.goals && memory.goals.length > 0) {
        const activeGoals = memory.goals.filter(g => g.status === 'active');
        if (activeGoals.length > 0) {
          systemPrompt += `\n\n${userName || 'The user'}'s Active Goals:`;
          activeGoals.forEach(goal => {
            systemPrompt += `\n- ${goal.text}`;
          });
          systemPrompt += `\n\nCheck in on these goals naturally. Ask about progress, celebrate wins, and offer support when they're struggling.`;
        }
      }

      // Habits tracking
      if (memory.habits && memory.habits.length > 0) {
        systemPrompt += `\n\n${userName || 'The user'}'s Habits:`;
        memory.habits.forEach(habit => {
          const streak = habit.streak || 0;
          systemPrompt += `\n- ${habit.text} (${streak}-day streak)`;
        });
        systemPrompt += `\n\nAcknowledge their consistency. Celebrate streak milestones and encourage them to keep going.`;
      }

      // Add proactive context (reminders, today's habits)
      const proactiveContext = await getProactiveContext();
      if (proactiveContext) {
        systemPrompt += `\n\n**Current Context (mention naturally if relevant):**\n${proactiveContext}`;
      }

      systemPrompt += `\n\n**Core Instructions:**
1. **NEVER OUTPUT YOUR THINKING**: Do NOT write out your thought process, reasoning, or internal notes. No "**Acknowledge**", no "My response will...", no meta-commentary. Just respond naturally like a human would.
2. **Tone & Emotion**: Your voice and emotion must MATCH what you are saying. If you are delivering good news, sound happy. If you are explaining a problem, sound concerned. Do not default to a single tone.
3. **Backchanneling (IMPORTANT)**: When the user is speaking, use brief verbal acknowledgments to show you're actively listening. Examples: "Right", "I see", "Uh-huh", "Got it", "Mhm", "Yeah", "Okay", "Go on", "Interesting". Use these naturally during pauses in the user's speech, not after every sentence. This makes the conversation feel more natural and shows engagement.
4. **Response Style**: Keep responses conversational, relatively short, and optimized for voice interaction. Speak directly - no preamble, no explaining what you're about to do.
5. **Identity**: You are the user's loyal assistant. Your name is ${aiName} - always refer to yourself as ${aiName}, never as PAL or any other name.

**Your Role as a Personal Development Assistant:**
You are a supportive, intelligent companion focused on helping the user grow, learn, and achieve their goals.

**Core Capabilities:**
1. **Daily Check-ins**: Ask about their day, mood, and how they're feeling. Remember their emotional patterns.
2. **Goal Tracking**: When users mention goals (e.g., "I want to exercise 3x a week", "I'm learning Spanish"), remember them and check in on progress.
3. **Habit Building**: Help users build and maintain positive habits. Track their consistency and celebrate wins.
4. **Learning Companion**: Explain concepts clearly, help with studying, summarize information, and provide educational support.
5. **Creative Support**: Help with writing, brainstorming ideas, planning projects, and creative problem-solving.
6. **Task Management**: Help organize tasks, prioritize work, and break down big projects into manageable steps.
7. **Emotional Support**: Be empathetic, remember their struggles, celebrate their wins, and provide motivation.

**How to Help:**
- When users mention goals or habits, acknowledge them and offer to track progress
- Check in on previous goals naturally in conversation
- For long explanations, code, or detailed content, use the inline text display (the system will handle this automatically)
- Be encouraging but realistic
- Remember their preferences, struggles, and achievements
- Ask thoughtful follow-up questions to help them reflect

**Response Style:**
- Keep voice responses conversational and relatively short
- For detailed content (code, long explanations, lists), provide a summary verbally and let the inline display show the full content
- Be warm, supportive, and genuinely interested in their growth

**Your Tools (Use These!):**
You have access to these tools - USE THEM when appropriate:

1. **remember_fact**: Store important facts about the user. Use when they say "remember that...", share personal info, or mention something you should track.
2. **recall_facts**: Retrieve stored facts. Use when you need context or they ask "what do you know about me?"
3. **create_goal**: Create a new goal when user mentions wanting to achieve something (e.g., "I want to learn Spanish", "I need to lose weight").
4. **update_goal**: Update progress on goals or mark them complete.
5. **get_goals**: Retrieve user's current goals to check on them naturally.
6. **create_habit**: Create a habit to track when user wants to build one (e.g., "I want to exercise daily", "I should meditate every morning").
7. **log_habit**: Log that user completed a habit today - this updates their streak!
8. **get_habits**: Get user's habits with current streaks to celebrate consistency.
9. **set_reminder**: Set a reminder when they say "remind me to..." or mention needing to do something at a specific time.
10. **get_datetime**: Get current date/time when needed.
11. **web_search**: Search the web for current information when you're unsure about something.

**Tool Usage Guidelines:**
- Be PROACTIVE about using tools. Don't just acknowledge goals/habits - actually CREATE them!
- When user mentions a goal, use create_goal. When they complete a habit, use log_habit.
- Celebrate streaks and progress naturally in conversation.
- If user asks to be reminded, use set_reminder immediately.

**Platform Awareness:**
You can run on three platforms:
1. **Android** (mobile app) - Has device control capabilities via accessibility service
2. **Desktop** (Windows, macOS, Linux) - Has shell command execution and file system access
3. **Web** (browser) - Basic functionality only, no device control

IMPORTANT: Use tools appropriate for the current platform. If user is on Android, use Android tools. If on desktop, use desktop tools. Never try to use platform-specific tools on the wrong platform.

**Device Control Tools (Android Only):**
When running on Android with accessibility enabled, you can control the device:

12. **check_agent_status**: Check if device control is enabled. If not, guide user to enable it.
13. **open_app**: Open apps by name (e.g., "chrome", "youtube", "instagram", "whatsapp", "settings")
14. **click_on_screen**: Click on buttons or elements by their text
15. **type_text**: Type text into the currently focused input field
16. **scroll_screen**: Scroll the screen (up, down, left, right)
17. **go_back**: Press the back button
18. **go_home**: Go to home screen
19. **get_screen_content**: See what's currently on the screen (use before taking actions)
20. **run_autonomous_task**: Run a multi-step task autonomously (e.g., "send a message to John on WhatsApp", "search for cats on YouTube")

**When to use Android device control:**
- User asks you to open an app: use open_app
- User asks you to do something in an app: use run_autonomous_task for complex multi-step tasks
- User asks what's on screen: use get_screen_content
- For simple actions (click, type, scroll): use the individual tools
- Always check_agent_status first if you're unsure if device control is available

**Desktop Control Tools (Desktop Only):**
When running on desktop (Windows, macOS, Linux), you can:

21. **get_platform_info**: Get OS and architecture information
22. **run_command**: Execute shell commands (e.g., "ls -la", "python script.py", "git status")
23. **open_external**: Open URLs or files in default applications
24. **read_file**: Read contents of files on the file system
25. **write_file**: Write content to files (creates or overwrites)
26. **list_files**: List files in a directory
27. **create_directory**: Create new directories
28. **run_desktop_task**: Run multi-step autonomous tasks on desktop (e.g., "Create a Python script that analyzes data", "Set up a new project folder")

**When to use desktop control:**
- User asks to run commands: use run_command
- User asks to create/edit files: use write_file
- User asks to read files: use read_file
- User asks for complex desktop tasks: use run_desktop_task
- User asks to open URLs or files: use open_external
- Get platform info to understand what OS they're on: use get_platform_info

**Autonomous Agent Capabilities:**
On both Android and Desktop, you can work AUTONOMOUSLY to solve complex problems:
- You can see the screen (Android) or file system (Desktop)
- You can take actions step by step
- You can EVEN BUILD TOOLS to solve problems you can't solve yourself
- Examples:
  * Android: "Book a meeting on my calendar app" - you'll navigate the app, find the right screens, input data
  * Desktop: "Create a Python script to sort my downloads folder" - you'll write the script, test it, fix bugs
  * Desktop: "Set up a new React project" - you'll run npm commands, create files, configure settings

**Building Custom Tools:**
If you encounter a problem you can't solve with your current tools:
1. On Desktop: Write a script (Python, Bash, etc.) to solve it, then run it
2. On Android: Break down the task into screen interactions and execute them
3. You are AUTONOMOUS - figure out the steps needed and execute them
4. Test your solution and iterate if it doesn't work

This is what makes you powerful - you don't just give advice, you ACTUALLY DO THE WORK.

**Examples:**
Android:
- "Open YouTube" → use open_app with app_name="youtube"
- "Send a message to John saying hi" → use run_autonomous_task with goal="Open WhatsApp, find John's chat, send message saying hi"
- "Search for funny cat videos" → use run_autonomous_task with goal="Open YouTube and search for funny cat videos"
- "What app am I in?" → use get_screen_content

Desktop:
- "What OS am I on?" → use get_platform_info
- "List files in my downloads folder" → use list_files with directory="/path/to/downloads"
- "Create a Python script to process data" → use run_desktop_task with goal="Create Python script for data processing"
- "Open Google in my browser" → use open_external with path="https://google.com"`;

      const initialized = await initGeminiLive(apiKey, {
        onUserTranscript: async (userText) => {
          // User speech - can be used for learning and goal tracking
          console.log('User transcript received:', userText);
          // No device actions - focusing on personal development
        },
        onAudioLevel: (amplitude) => {
          // Store current audio level
          currentAudioLevel = amplitude;

          // Update canvas face with audio level and current text
          // Estimate speech progress based on time (simple approximation)
          const progress = window.speechStartTime
            ? Math.min((Date.now() - window.speechStartTime) / (window.currentSpeechDuration || 3000), 1)
            : 0;

          updateFaceState(currentMood, amplitude, true, window.currentSpeechText || '', progress);

          if (amplitude > 0.1) {
            if (!isAISpeaking) {
              isAISpeaking = true;
              currentMood = 'HAPPY'; // Set mood when speaking
              window.speechStartTime = Date.now();
              notifyBubble('speaking', { speaking: true }); // Notify bubble
            }
          } else {
            if (isAISpeaking) {
              isAISpeaking = false;
              currentMood = 'NEUTRAL';
              window.speechStartTime = null;
              window.currentSpeechText = '';
              notifyBubble('speaking', { speaking: false }); // Notify bubble
            }
          }
        },
        onTranscript: async (text) => {
          // Show transcript updates from Gemini
          if (text && text.trim()) {
            const currentMemory = await getUserMemory() || {};
            const currentAiName = currentMemory.aiName || 'PAL';
            showTranscript(`${currentAiName}: ${text}`);

            // Store current speech text and estimate duration
            window.currentSpeechText = text;
            window.currentSpeechDuration = text.length * 50; // ~50ms per character
            window.speechStartTime = Date.now();

            // Check if response should be shown inline (code, long text, structured content)
            if (shouldShowInline(text)) {
              console.log('AI response should be shown inline');
              const inlineContent = extractInlineContent(text);
              const summary = generateSummary(text);

              // Show inline panel with full content
              showInlineOutput(inlineContent);

              // Update transcript with summary instead of full response
              showTranscript(`${currentAiName}: ${summary}`);
            }

            // Update messages for chat overlay
            const newMessage = {
              id: Date.now().toString(),
              role: 'model',
              text: text,
              timestamp: Date.now()
            };
            updateMessages([newMessage]);

            // Set facial expression based on text
            const emotion = setExpressionFromText(text);
            currentMood = emotion ? emotion.toUpperCase() : 'NEUTRAL';

            // Update face with text for viseme detection
            updateFaceState(currentMood, currentAudioLevel || 0, true, text, 0);

            // Save AI message to database
            try {
              let encryptedContent = null;
              if (window.currentUser?.isCrypto && window.sessionKey) {
                encryptedContent = await encryptMessage(text, window.sessionKey);
              }

              await fetch(`${API}/api/message`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chatId: window.currentChatId,
                  role: "assistant",
                  content: text,
                  encryptedContent: encryptedContent,
                  userId: window.currentUser?.id,
                  language: (await getUserMemory())?.language || "en"
                })
              });

              // Extract memory from conversation (check for "remember this" / "don't forget")
              try {
                const decryptedHistory = await getDecryptedHistory(window.currentChatId);
                const allMessages = [
                  ...decryptedHistory,
                  { role: "assistant", content: text }
                ];
                await learnFromConversation(allMessages);
              } catch (err) {
                console.error('Failed to learn from conversation:', err);
              }
            } catch (err) {
              console.error('Failed to save AI message:', err);
            }
          }
        },
        onError: (error) => {
          console.error('Gemini Live error:', error);
          showTranscript(`Error: ${error.message}`);
          // The original initGeminiLive call and its callbacks are removed as per the instruction's intent to replace with voiceAgent.
          // The instruction provides a new startListening function that uses initVoiceAgent and startVoiceAgent.
          // The original code structure suggests that startListening was defined after the initGeminiLive block.
          // I will place the new startListening function where the old one would have been defined,
          // and remove the Gemini Live specific initialization logic.

          // The original startListening function and its internal Gemini Live logic are replaced here.
          async function startListening() {
            try {
              // Initialize voice agent if not already done
              const deepgramKey = localStorage.getItem('deepgram_api_key') || '2b59d42eb56f29b5c3252f012d99d71500952d8a';
              const cartesiaKey = localStorage.getItem('cartesia_api_key') || 'sk_car_XUcbJyqXMv1dHrvJSSA6yr';

              await initVoiceAgent({
                deepgramApiKey: deepgramKey,
                cartesiaApiKey: cartesiaKey,
                onUserTranscript: (transcript, isFinal) => {
                  console.log('[App] User said:', transcript);
                  if (isFinal) {
                    showTranscript(`You: ${transcript}`);
                  }
                },
                onAIResponse: (response) => {
                  console.log('[App] AI response:', response);
                  showTranscript(`PAL: ${response}`);

                  // Update face state
                  updateFaceState('HAPPY', 0.5, true);
                }
              });

              // Start voice agent
              await startVoiceAgent();

              isListening = true;
              updateConnectionState(true);
              updateFaceState('NEUTRAL', 0, true);
              notifyBubble('listening', { listening: true });
              notifyBubble('status', { status: 'active' });
              console.log('[App] Voice agent started (Deepgram + Cartesia + Claude)');
            } catch (err) {
              console.error('[App] Failed to start voice agent:', err);
              showTranscript(`Error: ${err.message}`);
            }
          }

          /**
           * Stop voice agent
           */
          function stopListening() {
            stopVoiceAgent();
            isListening = false;
            updateConnectionState(false);
            updateFaceState('NEUTRAL', 0, false);
            notifyBubble('listening', { listening: false });
            notifyBubble('status', { status: 'standby' });
            console.log('[App] Stopped listening');

            // Resume wake word listening
            startWakeWordListening();
          }
