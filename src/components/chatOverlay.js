/**
 * Chat Overlay Component
 * Based on: geminiapp/components/ChatOverlay.tsx
 * Converted to vanilla JavaScript
 */

let overlayElement = null;
let isConnectedState = false;
let messages = [];

/**
 * Initialize chat overlay
 */
export function initChatOverlay() {
  overlayElement = document.getElementById('chatOverlay');
  if (!overlayElement) {
    console.error('Chat overlay element not found');
    return;
  }

  // Initialize icons (load immediately)
  const initIcons = async () => {
    try {
      const { MicIcon, PowerIcon, TerminalIcon } = await import('./icons.js');
      const terminalIconEl = document.getElementById('terminalIcon');
      const micIconEl = document.getElementById('micIcon');
      const listeningMicIconEl = document.getElementById('listeningMicIcon');
      const powerIconEl = document.getElementById('powerIcon');

      if (terminalIconEl) terminalIconEl.innerHTML = TerminalIcon;
      if (micIconEl) micIconEl.innerHTML = MicIcon;
      if (listeningMicIconEl) listeningMicIconEl.innerHTML = MicIcon;
      if (powerIconEl) powerIconEl.innerHTML = PowerIcon;
    } catch (err) {
      console.error('Failed to load icons:', err);
    }
  };
  
  initIcons();

  // Setup activate button
  const activateBtn = document.getElementById('activatePalBtn');
  if (activateBtn) {
    activateBtn.addEventListener('click', () => {
      if (window.onActivatePal) {
        window.onActivatePal();
      }
    });
  }

  // Setup disconnect button
  const disconnectBtn = document.getElementById('disconnectPalBtn');
  if (disconnectBtn) {
    disconnectBtn.addEventListener('click', () => {
      if (window.onDisconnectPal) {
        window.onDisconnectPal();
      }
    });
  }
}

/**
 * Update connection state
 */
export function updateConnectionState(connected) {
  isConnectedState = connected;
  if (!overlayElement) return;

  const activateSection = overlayElement.querySelector('.activate-section');
  const liveControls = overlayElement.querySelector('.live-controls');
  const statusIndicator = overlayElement.querySelector('.status-indicator');
  const statusText = overlayElement.querySelector('.status-text');

  if (activateSection) {
    activateSection.style.display = connected ? 'none' : 'flex';
  }

  if (liveControls) {
    liveControls.style.display = connected ? 'flex' : 'none';
  }

  if (statusIndicator) {
    statusIndicator.className = `status-dot ${connected ? 'live' : 'standby'}`;
  }

  if (statusText) {
    statusText.textContent = connected ? 'LIVE FEED' : 'STANDBY';
  }
}

/**
 * Update messages
 */
export function updateMessages(newMessages) {
  messages = newMessages || [];
  if (!overlayElement) return;

  const transcriptEl = overlayElement.querySelector('.transcript-text');
  if (transcriptEl && messages.length > 0) {
    const lastMessage = messages[messages.length - 1];
    transcriptEl.textContent = `"${lastMessage.text}"`;
    transcriptEl.style.display = 'block';
  } else if (transcriptEl) {
    transcriptEl.style.display = 'none';
  }
}

/**
 * Show/hide overlay
 */
export function showChatOverlay() {
  if (overlayElement) {
    overlayElement.classList.remove('hidden');
  }
}

export function hideChatOverlay() {
  if (overlayElement) {
    overlayElement.classList.add('hidden');
  }
}
