let isSpeaking = false;
let isRecording = false;
let mouthPath = null;

export function initAssistantFace(onTap) {
  const face = document.getElementById("assistantFace");
  if (!face) return;

  // Get mouth path element for animation
  mouthPath = face.querySelector("#mouth");

  // Set initial idle state
  face.classList.add("idle");

  // Click/tap to toggle listening
  face.addEventListener("click", (e) => {
    if (onTap) onTap();
  });

  // Track cursor for eye following only
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

  // Calculate angle to cursor
  const deltaX = e.clientX - faceCenterX;
  const deltaY = e.clientY - faceCenterY;

  // Convert to 0-100 range for lookAt function
  const normalizedX = 50 + (deltaX / window.innerWidth) * 100;
  const normalizedY = 50 + (deltaY / window.innerHeight) * 100;

  // Import lookAt from faceExpressions
  import('./faceExpressions.js').then(({ lookAt }) => {
    lookAt(normalizedX, normalizedY);
  });
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

  import('./faceExpressions.js').then(({ lookAt }) => {
    lookAt(normalizedX, normalizedY);
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

  // More dynamic mouth shapes based on amplitude
  const threshold = 0.3;

  if (amplitude > threshold) {
    // Wide open - rounded rectangle shape
    const openness = Math.min(amplitude * 1.5, 1);
    const height = 15 + (openness * 10);
    mouthPath.setAttribute('d', `M35 75 Q35 ${75 + height/2} 45 ${75 + height/2} L75 ${75 + height/2} Q85 ${75 + height/2} 85 75 Q85 ${75 - height/2} 75 ${75 - height/2} L45 ${75 - height/2} Q35 ${75 - height/2} 35 75`);
  } else if (amplitude > 0.1) {
    // Medium - ellipse shape
    const controlY = 85 + (amplitude * 15);
    mouthPath.setAttribute('d', `M35 75 Q60 ${controlY} 85 75`);
  } else {
    // Closed - gentle smile
    mouthPath.setAttribute('d', 'M35 75 Q60 85 85 75');
  }
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
