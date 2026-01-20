let expanded = false;
let isSpeaking = false;
let mouthPath = null;

export function initAssistantFace() {
  const face = document.getElementById("assistantFace");
  if (!face) return;

  // Get mouth path element for animation
  mouthPath = face.querySelector("path");

  face.addEventListener("click", toggleExpand);
}

function toggleExpand() {
  expanded = !expanded;
  document.body.classList.toggle("expanded", expanded);
}

/**
 * Start speaking animation
 */
export function startSpeaking() {
  isSpeaking = true;
  const face = document.getElementById("assistantFace");
  if (face) {
    face.classList.add("speaking");
    face.classList.remove("idle");
  }
  console.log('Face started speaking');
}

/**
 * Stop speaking animation
 */
export function stopSpeaking() {
  isSpeaking = false;
  const face = document.getElementById("assistantFace");
  if (face) {
    face.classList.remove("speaking");
    face.classList.add("idle");
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
