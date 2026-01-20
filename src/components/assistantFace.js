let isSpeaking = false;
let isRecording = false;
let mouthPath = null;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let faceX = 0;
let faceY = 0;

export function initAssistantFace(onTap) {
  const face = document.getElementById("assistantFace");
  if (!face) return;

  // Get mouth path element for animation
  mouthPath = face.querySelector("#mouth");

  // Set initial idle state
  face.classList.add("idle");

  // Make face draggable
  face.addEventListener("mousedown", (e) => {
    if (e.target.closest('svg')) {
      isDragging = true;
      face.classList.add("dragging");

      const rect = face.getBoundingClientRect();
      dragStartX = e.clientX - rect.left;
      dragStartY = e.clientY - rect.top;

      e.preventDefault();
    }
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;

    const newX = e.clientX - dragStartX;
    const newY = e.clientY - dragStartY;

    // Keep face within viewport bounds
    const maxX = window.innerWidth - face.offsetWidth;
    const maxY = window.innerHeight - face.offsetHeight;

    faceX = Math.max(0, Math.min(newX, maxX));
    faceY = Math.max(0, Math.min(newY, maxY));

    face.style.left = faceX + 'px';
    face.style.top = faceY + 'px';
    face.style.transform = 'none';
  });

  document.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      face.classList.remove("dragging");

      // If barely moved, treat as a tap
      if (Math.abs(faceX) < 10 && Math.abs(faceY) < 10) {
        if (onTap) onTap();
      }
    }
  });

  // Touch support for mobile
  face.addEventListener("touchstart", (e) => {
    isDragging = true;
    face.classList.add("dragging");

    const touch = e.touches[0];
    const rect = face.getBoundingClientRect();
    dragStartX = touch.clientX - rect.left;
    dragStartY = touch.clientY - rect.top;

    e.preventDefault();
  });

  document.addEventListener("touchmove", (e) => {
    if (!isDragging) return;

    const touch = e.touches[0];
    const newX = touch.clientX - dragStartX;
    const newY = touch.clientY - dragStartY;

    const maxX = window.innerWidth - face.offsetWidth;
    const maxY = window.innerHeight - face.offsetHeight;

    faceX = Math.max(0, Math.min(newX, maxX));
    faceY = Math.max(0, Math.min(newY, maxY));

    face.style.left = faceX + 'px';
    face.style.top = faceY + 'px';
    face.style.transform = 'none';
  });

  document.addEventListener("touchend", () => {
    if (isDragging) {
      isDragging = false;
      face.classList.remove("dragging");
    }
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
