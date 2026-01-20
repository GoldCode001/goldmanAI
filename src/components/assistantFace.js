let isSpeaking = false;
let isRecording = false;
let mouthPath = null;
let faceX = 50; // % of screen
let faceY = 50; // % of screen
let targetX = 50;
let targetY = 50;
let movementInterval = null;

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

  // Start autonomous movement
  startAutonomousMovement();

  // Track cursor for eye following
  document.addEventListener("mousemove", handleCursorMove);

  // Track touch for mobile eye following
  document.addEventListener("touchmove", handleTouchMove);
}

/**
 * Start smooth autonomous movement around the screen
 */
function startAutonomousMovement() {
  const face = document.getElementById("assistantFace");
  if (!face) return;

  // Move to random positions every 5-8 seconds
  const changeTarget = () => {
    // Random position within viewport (20-80% to avoid edges)
    targetX = 20 + Math.random() * 60;
    targetY = 20 + Math.random() * 60;
  };

  // Update position smoothly using animation frame
  const updatePosition = () => {
    // Smooth interpolation (ease toward target)
    const speed = 0.02; // Lower = smoother
    faceX += (targetX - faceX) * speed;
    faceY += (targetY - faceY) * speed;

    // Apply position
    face.style.left = `${faceX}%`;
    face.style.top = `${faceY}%`;

    requestAnimationFrame(updatePosition);
  };

  // Start movement loop
  changeTarget(); // Set initial target
  updatePosition(); // Start animation loop

  // Change target periodically
  movementInterval = setInterval(changeTarget, 5000 + Math.random() * 3000);
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
