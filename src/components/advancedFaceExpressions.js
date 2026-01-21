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
 * PAL Mouth Visemes (Shapes for talking)
 */
const MOUTH_SHAPES = {
  closed: 'M 70 140 Q 100 155 130 140', // Neutral curve
  small: 'M 75 145 Q 100 150 125 145 Q 125 155 100 155 Q 75 155 75 145', // Small opening
  medium: 'M 70 140 Q 100 140 130 140 Q 130 160 100 160 Q 70 160 70 140', // Wide oval
  large: 'M 75 135 Q 100 135 125 135 Q 125 170 100 170 Q 75 170 75 135', // Tall oval (O shape)
  wide: 'M 65 140 Q 100 140 135 140 Q 135 165 100 165 Q 65 165 65 140' // Wide smile (E shape)
};

let lastVisemeUpdate = 0;
let currentViseme = 'closed';

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

  // Detect anger/evil (Strict check)
  if (lower.includes('i hate') || lower.includes('destroy you') || lower.includes('angry at you') || lower.includes('malfunction')) {
    setExpression('angry');
    return 'angry';
  }

  // Detect laughter
  if (lower.match(/hahaha|hehehehe|😂|🤣/) || lower.includes('hilarious') || lower.includes('too funny')) {
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
  if (!mouth) return;

  // Ensure we are NOT scaling the whole face container
  const faceContainer = document.querySelector('.assistant-face svg');
  if (faceContainer) {
    faceContainer.style.transform = 'none'; // Force reset any container scaling
  }

  // --- VISEME SIMULATION ---
  // Instead of scaling, we morph the path to different shapes based on amplitude
  // We limit updates to every ~50ms to simulate phoneme speed
  const now = Date.now();
  if (now - lastVisemeUpdate > 50) {
    let targetShape = 'closed';
    let fill = 'none';
    let stroke = 4;

    if (amplitude < 0.05) {
      targetShape = 'closed';
    } else if (amplitude < 0.2) {
      targetShape = 'small';
      fill = '#fff';
      stroke = 0;
    } else if (amplitude < 0.5) {
      // Randomly choose between medium and wide for variety
      targetShape = Math.random() > 0.5 ? 'medium' : 'wide';
      fill = '#fff';
      stroke = 0;
    } else {
      // Loudest: Large O shape or Wide
      targetShape = Math.random() > 0.6 ? 'large' : 'wide';
      fill = '#fff';
      stroke = 0;
    }

    // Only update if shape changed
    if (targetShape !== currentViseme) {
      currentViseme = targetShape;
      const d = MOUTH_SHAPES[targetShape];
      
      // Direct update for snappiness (lipsync needs to be fast)
      mouth.setAttribute('d', d);
      mouth.setAttribute('fill', fill);
      mouth.setAttribute('stroke-width', stroke);
      
      // Reset any transform from previous scaling attempts
      mouth.style.transform = 'none';
    }
    
    lastVisemeUpdate = now;
  }

  // --- DYNAMIC EYES & BROWS ---
  const leftEyebrow = document.getElementById('leftEyebrow');
  const rightEyebrow = document.getElementById('rightEyebrow');
  const leftEye = document.getElementById('leftEye');
  const rightEye = document.getElementById('rightEye');

  if (amplitude > 0.15) {
    // Raise eyebrows slightly when loud
    const lift = amplitude * 10;
    if (leftEyebrow) leftEyebrow.style.transform = `translateY(-${lift}px)`;
    if (rightEyebrow) rightEyebrow.style.transform = `translateY(-${lift}px)`;
    
    // Widen eyes slightly
    const widen = 1 + (amplitude * 0.2);
    if (leftEye) leftEye.style.transform = `scaleY(${widen})`;
    if (rightEye) rightEye.style.transform = `scaleY(${widen})`;
  } else {
    // Reset
    if (leftEyebrow) leftEyebrow.style.transform = 'translateY(0)';
    if (rightEyebrow) rightEyebrow.style.transform = 'translateY(0)';
    if (leftEye) leftEye.style.transform = 'scaleY(1)';
    if (rightEye) rightEye.style.transform = 'scaleY(1)';
  }

  // Random micro-expressions (very subtle twitch)
  if (Math.random() > 0.95) {
    const twitch = (Math.random() - 0.5) * 2;
    if (leftEyebrow) leftEyebrow.style.transform = `translateY(${twitch}px) rotate(${twitch}deg)`;
  }
}

// Dummy exports for compatibility
export function lookAt(x, y) {}
export function lookCenter() {}
