/**
 * Face Expressions - Control expressive animations for PAL's face
 */

let blinkInterval = null;
let currentExpression = 'neutral';

/**
 * Initialize automatic blinking
 */
export function startBlinking() {
  if (blinkInterval) return;

  // Blink every 3-5 seconds randomly
  blinkInterval = setInterval(() => {
    const delay = 3000 + Math.random() * 2000;
    setTimeout(blink, delay);
  }, 5000);
}

/**
 * Stop automatic blinking
 */
export function stopBlinking() {
  if (blinkInterval) {
    clearInterval(blinkInterval);
    blinkInterval = null;
  }
}

/**
 * Perform a blink animation
 */
function blink() {
  const leftLid = document.getElementById('leftEyelid');
  const rightLid = document.getElementById('rightEyelid');

  if (!leftLid || !rightLid) return;

  // Close eyes
  leftLid.style.opacity = '1';
  rightLid.style.opacity = '1';
  leftLid.setAttribute('ry', '10');
  rightLid.setAttribute('ry', '10');

  // Open eyes after 150ms
  setTimeout(() => {
    leftLid.setAttribute('ry', '0');
    rightLid.setAttribute('ry', '0');
    setTimeout(() => {
      leftLid.style.opacity = '0';
      rightLid.style.opacity = '0';
    }, 100);
  }, 150);
}

/**
 * Wink animation
 */
export function wink() {
  const leftLid = document.getElementById('leftEyelid');
  if (!leftLid) return;

  leftLid.style.opacity = '1';
  leftLid.setAttribute('ry', '10');

  setTimeout(() => {
    leftLid.setAttribute('ry', '0');
    setTimeout(() => {
      leftLid.style.opacity = '0';
    }, 100);
  }, 300);
}

/**
 * Set facial expression
 * @param {string} expression - Expression type: 'neutral', 'happy', 'excited', 'laugh', 'playful'
 */
export function setExpression(expression) {
  currentExpression = expression;
  const mouth = document.getElementById('mouth');
  const teeth = document.getElementById('teeth');
  const tongue = document.getElementById('tongue');

  if (!mouth) return;

  // Reset all special elements
  if (teeth) teeth.style.opacity = '0';
  if (tongue) tongue.style.opacity = '0';

  switch (expression) {
    case 'happy':
      // Big smile
      mouth.setAttribute('d', 'M30 75 Q60 95 90 75');
      break;

    case 'excited':
      // Wide open smile
      mouth.setAttribute('d', 'M30 70 Q60 100 90 70');
      break;

    case 'laugh':
      // Open mouth with teeth
      mouth.setAttribute('d', 'M30 75 Q60 100 90 75');
      if (teeth) teeth.style.opacity = '1';
      break;

    case 'playful':
      // Stick out tongue
      mouth.setAttribute('d', 'M35 75 Q60 85 85 75');
      if (tongue) tongue.style.opacity = '1';
      break;

    case 'neutral':
    default:
      // Gentle smile
      mouth.setAttribute('d', 'M35 75 Q60 90 85 75');
      break;
  }
}

/**
 * Animate pupils following a point (like looking around)
 * @param {number} x - X coordinate (0-100)
 * @param {number} y - Y coordinate (0-100)
 */
export function lookAt(x, y) {
  const leftPupil = document.getElementById('leftPupil');
  const rightPupil = document.getElementById('rightPupil');

  if (!leftPupil || !rightPupil) return;

  // Calculate pupil offset (max 3px from center)
  const offsetX = (x - 50) * 0.06;
  const offsetY = (y - 50) * 0.06;

  leftPupil.setAttribute('cx', 35 + offsetX);
  leftPupil.setAttribute('cy', 45 + offsetY);
  rightPupil.setAttribute('cx', 85 + offsetX);
  rightPupil.setAttribute('cy', 45 + offsetY);
}

/**
 * Reset pupils to center
 */
export function lookCenter() {
  const leftPupil = document.getElementById('leftPupil');
  const rightPupil = document.getElementById('rightPupil');

  if (!leftPupil || !rightPupil) return;

  leftPupil.setAttribute('cx', '35');
  leftPupil.setAttribute('cy', '45');
  rightPupil.setAttribute('cx', '85');
  rightPupil.setAttribute('cy', '45');
}

/**
 * Detect sentiment from text and set appropriate expression
 * @param {string} text - AI response text
 */
export function expressFromText(text) {
  const lower = text.toLowerCase();

  // Detect playful/joking
  if (lower.includes('haha') || lower.includes('lol') || lower.match(/😜|😛|😝/)) {
    setExpression('playful');
    return 'playful';
  }

  // Detect laughter
  if (lower.match(/hahaha|😂|🤣/) || lower.includes('hilarious')) {
    setExpression('laugh');
    return 'laugh';
  }

  // Detect excitement
  if (lower.match(/!/) && (lower.includes('amazing') || lower.includes('awesome') || lower.includes('incredible'))) {
    setExpression('excited');
    return 'excited';
  }

  // Detect happiness
  if (lower.includes('happy') || lower.includes('great') || lower.match(/😊|😄|🙂/)) {
    setExpression('happy');
    return 'happy';
  }

  // Default to neutral
  setExpression('neutral');
  return 'neutral';
}
