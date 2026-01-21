/**
 * PAL-Style Face Expressions using Anime.js
 * Inspired by "The Mitchells vs. The Machines"
 * Simple geometric shapes: vertical pill eyes, curved eyebrows, morphing mouth path
 */

// Import anime from CDN (loaded in index.html)
const anime = window.anime;

let currentExpression = 'neutral';
let blinkInterval = null;

/**
 * Expression definitions - PAL style (simple geometric shapes)
 */
const EXPRESSIONS = {
  neutral: {
    leftEyebrow: 'M 50 60 Q 65 55 80 60',
    rightEyebrow: 'M 120 60 Q 135 55 150 60',
    // Eyes: tall pills
    eyeHeight: 40,
    eyeY: 70,
    // Mouth: Gentle curve
    mouthPath: 'M 70 140 Q 100 155 130 140', // Simple smile curve
    mouthFill: 'none',
    mouthStroke: 4
  },

  happy: {
    leftEyebrow: 'M 50 55 Q 65 45 80 55',
    rightEyebrow: 'M 120 55 Q 135 45 150 55',
    eyeHeight: 38,
    eyeY: 71,
    // Mouth: The "Bowl" shape (filled)
    mouthPath: 'M 70 140 Q 100 165 130 140 Z', // Closed loop bowl
    mouthFill: '#fff',
    mouthStroke: 0
  },

  angry: {
    leftEyebrow: 'M 50 65 L 80 75', // Sharp angle down
    rightEyebrow: 'M 120 75 L 150 65',
    eyeHeight: 35, // Narrower eyes
    eyeY: 72,
    // Mouth: Frown curve
    mouthPath: 'M 75 150 Q 100 130 125 150',
    mouthFill: 'none',
    mouthStroke: 4
  },

  surprised: {
    leftEyebrow: 'M 50 45 Q 65 40 80 45',
    rightEyebrow: 'M 120 45 Q 135 40 150 45',
    eyeHeight: 50, // Taller eyes
    eyeY: 65,
    // Mouth: Tall oval/pill shape
    mouthPath: 'M 85 130 Q 100 130 115 130 Q 115 160 100 160 Q 85 160 85 130 Z',
    mouthFill: '#fff',
    mouthStroke: 0
  },

  excited: {
    leftEyebrow: 'M 48 50 Q 65 45 82 50',
    rightEyebrow: 'M 118 50 Q 135 45 152 50',
    eyeHeight: 45, // Wide eyes
    eyeY: 68,
    // Mouth: Big open smile
    mouthPath: 'M 70 140 Q 100 170 130 140 Z',
    mouthFill: '#fff',
    mouthStroke: 0
  },

  playful: {
    leftEyebrow: 'M 50 55 Q 65 50 80 55',
    rightEyebrow: 'M 120 62 Q 135 60 150 62', // One lower
    eyeHeight: 38,
    eyeY: 71,
    // Mouth: Smirk
    mouthPath: 'M 75 145 Q 100 155 125 135',
    mouthFill: 'none',
    mouthStroke: 4
  }
};

/**
 * Set facial expression with smooth animation
 */
export function setExpression(expression, duration = 500) {
  if (!EXPRESSIONS[expression]) {
    console.warn(`Unknown expression: ${expression}`);
    return;
  }

  currentExpression = expression;
  const exp = EXPRESSIONS[expression];

  // PAL "Evil Mode" Logic
  const faceContainer = document.getElementById('assistantFace');
  if (faceContainer) {
    if (expression === 'angry') {
      faceContainer.classList.add('evil-mode');
    } else {
      faceContainer.classList.remove('evil-mode');
    }
  }

  // Animate Eyebrows (Path Morphing)
  anime({
    targets: '#leftEyebrow',
    d: exp.leftEyebrow,
    duration: duration,
    easing: 'easeOutElastic(1, .6)'
  });
  anime({
    targets: '#rightEyebrow',
    d: exp.rightEyebrow,
    duration: duration,
    easing: 'easeOutElastic(1, .6)'
  });

  // Animate Eyes (Height/Y changes)
  anime({
    targets: ['#leftEye', '#rightEye'],
    height: exp.eyeHeight,
    y: exp.eyeY,
    duration: duration,
    easing: 'easeOutQuad'
  });

  // Animate Mouth (Path Morphing + Fill change)
  const mouth = document.getElementById('mouth');
  if (mouth) {
    // Handle fill/stroke switch instantly or smoothly
    // For fill/stroke, we set attributes directly as they don't animate well with anime.js path morphing
    mouth.setAttribute('fill', exp.mouthFill);
    mouth.setAttribute('stroke-width', exp.mouthStroke);

    anime({
      targets: '#mouth',
      d: exp.mouthPath,
      duration: duration,
      easing: 'easeOutElastic(1, .8)'
    });
  }

  console.log(`Expression set to: ${expression}`);
}

/**
 * Perform a blink animation (eyes shrink vertically)
 */
export function blink() {
  const timeline = anime.timeline({
    easing: 'easeInOutQuad'
  });

  // Close eyes (shrink vertically)
  timeline.add({
    targets: ['#leftEye', '#rightEye'],
    height: 2,
    y: 90, // Move down to center of eye position
    duration: 80
  });

  // Open eyes (return to current expression)
  const exp = EXPRESSIONS[currentExpression] || EXPRESSIONS.neutral;
  timeline.add({
    targets: ['#leftEye', '#rightEye'],
    height: exp.eyeHeight,
    y: exp.eyeY,
    duration: 120
  }, 80);
}

/**
 * Wink (left eye only)
 */
export function wink() {
  const timeline = anime.timeline({
    easing: 'easeInOutQuad'
  });

  timeline.add({
    targets: '#leftEye',
    height: 2,
    y: 90,
    duration: 80
  });

  const exp = EXPRESSIONS[currentExpression] || EXPRESSIONS.neutral;
  timeline.add({
    targets: '#leftEye',
    height: exp.eyeHeight,
    y: exp.eyeY,
    duration: 150
  }, 250);
}

/**
 * Start automatic blinking
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
 * Stop automatic animations
 */
export function stopBlinking() {
  if (blinkInterval) {
    clearInterval(blinkInterval);
    blinkInterval = null;
  }
}

/**
 * Detect sentiment from AI text and set expression
 */
export function expressFromText(text) {
  const lower = text.toLowerCase();

  // Detect anger/evil
  if (lower.includes('angry') || lower.includes('hate') || lower.includes('destroy') || lower.includes('glitch')) {
    setExpression('angry');
    return 'angry';
  }

  // Detect laughter
  if (lower.match(/hahaha|hehehehe|😂|🤣/) || lower.includes('hilarious')) {
    setExpression('excited');
    return 'excited';
  }

  // Detect playful
  if (lower.includes('hehe') || lower.includes('haha') || lower.includes('lol') || lower.match(/😜|😛|😝/)) {
    setExpression('playful');
    return 'playful';
  }

  // Detect excitement
  if (lower.match(/!{2,}/) || (lower.match(/!/) && (lower.includes('amazing') || lower.includes('awesome') || lower.includes('incredible')))) {
    setExpression('excited');
    return 'excited';
  }

  // Detect surprise
  if (lower.includes('wow') || lower.includes('whoa') || lower.includes('omg')) {
    setExpression('surprised');
    return 'surprised';
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

/**
 * Dynamic mouth animation during speech (mouth opens/closes vertically like PAL)
 * @param {number} amplitude - Audio amplitude (0-1)
 */
export function animateSpeechMouth(amplitude) {
  const mouth = document.getElementById('mouth');
  const face = document.querySelector('.assistant-face svg');
  
  if (!mouth || !face) return;

  // Map amplitude 0-1 to scale 1-3
  const scaleY = 1 + (amplitude * 3);
  
  // Mouth animation
  mouth.style.transformOrigin = "100px 140px";
  mouth.style.transform = `scaleY(${scaleY})`;

  // Squash and stretch the whole face based on loudness
  // Louder = taller/thinner (stretch)
  // Quieter = wider/shorter (squash)
  const stretch = 1 + (amplitude * 0.1);
  const squash = 1 - (amplitude * 0.05);
  
  face.style.transform = `scale(${squash}, ${stretch})`;
}

// Dummy exports for compatibility
export function lookAt(x, y) {}
export function lookCenter() {}
