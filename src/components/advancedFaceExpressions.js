/**
 * PAL-Style Face Expressions using Anime.js
 * Inspired by "The Mitchells vs. The Machines"
 * Simple geometric shapes: oval eyes, curved eyebrows, rounded rectangle mouth
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
    // Eyebrows - slight curve
    leftEyebrow: 'M 50 60 Q 65 55 80 60',
    rightEyebrow: 'M 120 60 Q 135 55 150 60',

    // Eyes - normal size
    leftEyeRx: 18,
    leftEyeRy: 22,
    rightEyeRx: 18,
    rightEyeRy: 22,

    // Mouth - small oval (closed)
    mouthRy: 8
  },

  happy: {
    // Eyebrows - raised and curved
    leftEyebrow: 'M 50 55 Q 65 50 80 55',
    rightEyebrow: 'M 120 55 Q 135 50 150 55',

    // Eyes - slightly squinted
    leftEyeRx: 16,
    leftEyeRy: 18,
    rightEyeRx: 16,
    rightEyeRy: 18,

    // Mouth - wider smile
    mouthRy: 12
  },

  excited: {
    // Eyebrows - very high
    leftEyebrow: 'M 48 50 Q 65 45 82 50',
    rightEyebrow: 'M 118 50 Q 135 45 152 50',

    // Eyes - WIDE
    leftEyeRx: 22,
    leftEyeRy: 28,
    rightEyeRx: 22,
    rightEyeRy: 28,

    // Mouth - big open
    mouthRy: 20
  },

  surprised: {
    // Eyebrows - super high
    leftEyebrow: 'M 48 45 Q 65 40 82 45',
    rightEyebrow: 'M 118 45 Q 135 40 152 45',

    // Eyes - VERY WIDE circles
    leftEyeRx: 24,
    leftEyeRy: 30,
    rightEyeRx: 24,
    rightEyeRy: 30,

    // Mouth - O shape
    mouthRy: 18
  },

  playful: {
    // Eyebrows - one raised (wink effect)
    leftEyebrow: 'M 50 55 Q 65 50 80 55',
    rightEyebrow: 'M 120 62 Q 135 60 150 62',

    // Eyes - one smaller (wink)
    leftEyeRx: 12,
    leftEyeRy: 8,
    rightEyeRx: 18,
    rightEyeRy: 22,

    // Mouth - smirk
    mouthRy: 10
  },

  angry: {
    // Eyebrows - sharp angle down
    leftEyebrow: 'M 50 65 Q 65 58 80 55',
    rightEyebrow: 'M 120 55 Q 135 58 150 65',

    // Eyes - narrowed
    leftEyeRx: 18,
    leftEyeRy: 14,
    rightEyeRx: 18,
    rightEyeRy: 14,

    // Mouth - thin line (frown)
    mouthRy: 6
  }
};

/**
 * Set facial expression with smooth animation
 */
export function setExpression(expression, duration = 600) {
  if (!EXPRESSIONS[expression]) {
    console.warn(`Unknown expression: ${expression}`);
    return;
  }

  currentExpression = expression;
  const exp = EXPRESSIONS[expression];

  // Animate eyebrows
  anime({
    targets: '#leftEyebrow',
    d: exp.leftEyebrow,
    duration,
    easing: 'easeOutElastic(1, .6)'
  });

  anime({
    targets: '#rightEyebrow',
    d: exp.rightEyebrow,
    duration,
    easing: 'easeOutElastic(1, .6)'
  });

  // Animate eye shapes
  anime({
    targets: '#leftEye',
    rx: exp.leftEyeRx,
    ry: exp.leftEyeRy,
    duration,
    easing: 'easeOutQuad'
  });

  anime({
    targets: '#rightEye',
    rx: exp.rightEyeRx,
    ry: exp.rightEyeRy,
    duration,
    easing: 'easeOutQuad'
  });

  // Animate mouth (oval shape)
  anime({
    targets: '#mouth',
    ry: exp.mouthRy,
    duration,
    easing: 'easeOutElastic(1, .8)'
  });

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
    ry: 2,
    duration: 80
  });

  // Open eyes (return to current expression)
  const exp = EXPRESSIONS[currentExpression];
  timeline.add({
    targets: '#leftEye',
    ry: exp.leftEyeRy,
    duration: 120
  }, 80);

  timeline.add({
    targets: '#rightEye',
    ry: exp.rightEyeRy,
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
    ry: 2,
    duration: 80
  });

  const exp = EXPRESSIONS[currentExpression];
  timeline.add({
    targets: '#leftEye',
    ry: exp.leftEyeRy,
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
  const exp = EXPRESSIONS[currentExpression];

  if (amplitude > 0.2) {
    // WIDE OPEN - mouth expands vertically (oval gets taller)
    anime({
      targets: '#mouth',
      ry: 30,
      duration: 60,
      easing: 'easeOutQuad'
    });
  } else if (amplitude > 0.08) {
    // Medium open
    anime({
      targets: '#mouth',
      ry: 18,
      duration: 80,
      easing: 'easeOutQuad'
    });
  } else {
    // Back to expression default (closed)
    anime({
      targets: '#mouth',
      ry: exp.mouthRy,
      duration: 100,
      easing: 'easeOutQuad'
    });
  }
}

// Dummy exports for compatibility (not used in PAL design)
export function lookAt(x, y) {
  // PAL doesn't have pupils that move, just blinks
}

export function lookCenter() {
  // Not applicable to PAL design
}
