let isSpeaking = false;
let isRecording = false;
let mouthPath = null;

export function initAssistantFace(onTap) {
  const face = document.getElementById("assistantFace");
  if (!face) return;

  // Get mouth path element for animation
  mouthPath = face.querySelector("path");

  // Set initial idle state
  face.classList.add("idle");

  // Tap to talk
  face.addEventListener("click", () => {
    if (onTap) onTap();
  });
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

  resetMouth();
  console.log('Face stopped speaking');
}

/**
 * Update mouth shape based on audio amplitude
 * @param {number} amplitude - Normalized amplitude (0-1)
 */
export function updateMouth(amplitude) {
  if (!mouthPath || !isSpeaking) return;

  // Original path: M35 70 Q60 90 85 70
  // Animate the control point Y value based on amplitude
  const baseY = 70;
  const minControlY = 85; // Less open
  const maxControlY = 95; // More open
  const controlY = minControlY + (amplitude * (maxControlY - minControlY));

  mouthPath.setAttribute('d', `M35 ${baseY} Q60 ${controlY} 85 ${baseY}`);
}

/**
 * Reset mouth to default smile
 */
function resetMouth() {
  if (!mouthPath) return;
  mouthPath.setAttribute('d', 'M35 70 Q60 90 85 70');
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
    }, 3000); // Hide after 3 seconds
  }
}
