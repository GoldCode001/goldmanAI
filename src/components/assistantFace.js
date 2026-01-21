/**
 * Assistant Face Controller - Uses advanced expressions system
 */

import {
  setExpression,
  lookAt,
  lookCenter,
  startBlinking,
  stopBlinking,
  expressFromText,
  animateSpeechMouth
} from './advancedFaceExpressions.js';

let isSpeaking = false;
let isRecording = false;

export function initAssistantFace(onTap) {
  const face = document.getElementById("assistantFace");
  if (!face) return;

  // Set initial neutral expression
  setExpression('neutral');

  // Start automatic blinking and looking around
  startBlinking();

  // Set initial idle state
  face.classList.add("idle");

  // Click/tap to toggle listening
  face.addEventListener("click", (e) => {
    if (onTap) onTap();
  });

  // Track cursor for eye following
  document.addEventListener("mousemove", handleCursorMove);

  // Track touch for mobile eye following
  document.addEventListener("touchmove", handleTouchMove);
}

/**
 * Handle cursor movement for eye tracking
 */
function handleCursorMove(e) {
  const face = document.getElementById("assistantFace");
  if (!face) return;

  const rect = face.getBoundingClientRect();
  const faceCenterX = rect.left + rect.width / 2;
  const faceCenterY = rect.top + rect.height / 2;

  const deltaX = e.clientX - faceCenterX;
  const deltaY = e.clientY - faceCenterY;

  const normalizedX = 50 + (deltaX / window.innerWidth) * 100;
  const normalizedY = 50 + (deltaY / window.innerHeight) * 100;

  lookAt(normalizedX, normalizedY);
}

/**
 * Handle touch movement for eye tracking on mobile
 */
function handleTouchMove(e) {
  if (e.touches.length === 0) return;

  const face = document.getElementById("assistantFace");
  if (!face) return;

  const touch = e.touches[0];
  const rect = face.getBoundingClientRect();
  const faceCenterX = rect.left + rect.width / 2;
  const faceCenterY = rect.top + rect.height / 2;

  const deltaX = touch.clientX - faceCenterX;
  const deltaY = touch.clientY - faceCenterY;

  const normalizedX = 50 + (deltaX / window.innerWidth) * 100;
  const normalizedY = 50 + (deltaY / window.innerHeight) * 100;

  lookAt(normalizedX, normalizedY);
}

/**
 * Start recording animation
 */
export function startRecording() {
  isRecording = true;
  const face = document.getElementById("assistantFace");
  const statusText = document.getElementById("statusText");

  if (face) {
    face.classList.add("recording");
    face.classList.remove("idle", "speaking");
  }

  if (statusText) {
    statusText.textContent = "Listening... (tap to stop)";
  }

  // Show curious/attentive expression
  setExpression('neutral');
  console.log('Face started recording');
}

/**
 * Stop recording animation
 */
export function stopRecording() {
  isRecording = false;
  const face = document.getElementById("assistantFace");
  const statusText = document.getElementById("statusText");

  if (face) {
    face.classList.remove("recording");
    face.classList.add("idle");
  }

  if (statusText) {
    statusText.textContent = "Thinking...";
  }

  console.log('Face stopped recording');
}

/**
 * Start speaking animation
 */
export function startSpeaking() {
  isSpeaking = true;
  const face = document.getElementById("assistantFace");
  const statusText = document.getElementById("statusText");

  if (face) {
    face.classList.add("speaking");
    face.classList.remove("idle", "recording");
  }

  if (statusText) {
    statusText.textContent = "Speaking...";
  }

  console.log('Face started speaking');
}

/**
 * Stop speaking animation
 */
export function stopSpeaking() {
  isSpeaking = false;
  const face = document.getElementById("assistantFace");
  const statusText = document.getElementById("statusText");

  if (face) {
    face.classList.remove("speaking");
    face.classList.add("idle");
  }

  if (statusText) {
    statusText.textContent = "Tap to talk";
  }

  // Return to neutral expression
  setExpression('neutral');
  console.log('Face stopped speaking');
}

/**
 * Update mouth shape based on audio amplitude
 * @param {number} amplitude - Normalized amplitude (0-1)
 */
export function updateMouth(amplitude) {
  if (!isSpeaking) return;
  animateSpeechMouth(amplitude);
}

/**
 * Set expression based on AI text sentiment
 * @param {string} text - AI response text
 */
export function setExpressionFromText(text) {
  return expressFromText(text);
}

/**
 * Show transcript text overlay
 */
export function showTranscript(text) {
  const overlay = document.getElementById("transcriptOverlay");
  const textEl = document.getElementById("transcriptText");

  if (overlay && textEl) {
    textEl.textContent = text;
    overlay.classList.remove("hidden");
  }
}

/**
 * Hide transcript text overlay
 */
export function hideTranscript() {
  const overlay = document.getElementById("transcriptOverlay");
  if (overlay) {
    setTimeout(() => {
      overlay.classList.add("hidden");
    }, 3000);
  }
}
