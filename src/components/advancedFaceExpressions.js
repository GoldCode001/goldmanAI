/**
 * Advanced Face Expressions using Anime.js
 * Full range of expressions with eyebrows, eye shapes, and dynamic mouth
 */

import anime from 'animejs';

let currentExpression = 'neutral';
let blinkInterval = null;
let lookAroundInterval = null;

/**
 * Expression definitions with all facial feature states
 */
const EXPRESSIONS = {
  neutral: {
    // Eyebrows - slight arc
    leftEyebrow: 'M25 35 Q35 33 45 35',
    rightEyebrow: 'M75 35 Q85 33 95 35',

    // Eyes - normal open
    leftEyeRy: 12,
    rightEyeRy: 12,

    // Mouth - gentle smile
    mouth: 'M35 75 Q60 85 85 75',
    mouthFill: '',
    mouthFillOpacity: 0,

    // Features visibility
    teethOpacity: 0,
    tongueOpacity: 0
  },

  happy: {
    // Eyebrows - raised and curved
    leftEyebrow: 'M25 32 Q35 28 45 32',
    rightEyebrow: 'M75 32 Q85 28 95 32',

    // Eyes - squinting from smile
    leftEyeRy: 8,
    rightEyeRy: 8,

    // Mouth - big smile
    mouth: 'M30 70 Q60 95 90 70',
    mouthFill: '',
    mouthFillOpacity: 0,

    teethOpacity: 0,
    tongueOpacity: 0
  },

  excited: {
    // Eyebrows - high and wide
    leftEyebrow: 'M23 28 Q35 24 47 28',
    rightEyebrow: 'M73 28 Q85 24 97 28',

    // Eyes - wide open
    leftEyeRy: 15,
    rightEyeRy: 15,

    // Mouth - wide open smile
    mouth: 'M30 68 Q60 98 90 68',
    mouthFill: 'M30 68 Q60 98 90 68 Q85 82 60 85 Q35 82 30 68',
    mouthFillOpacity: 1,

    teethOpacity: 0,
    tongueOpacity: 0
  },

  laugh: {
    // Eyebrows - raised
    leftEyebrow: 'M25 30 Q35 26 45 30',
    rightEyebrow: 'M75 30 Q85 26 95 30',

    // Eyes - closed from laughing
    leftEyeRy: 3,
    rightEyeRy: 3,

    // Mouth - open with teeth showing
    mouth: 'M32 70 Q60 95 88 70',
    mouthFill: 'M32 70 Q60 95 88 70 Q85 85 60 88 Q35 85 32 70',
    mouthFillOpacity: 1,

    teethOpacity: 1,
    tongueOpacity: 0
  },

  playful: {
    // Eyebrows - one raised (wink)
    leftEyebrow: 'M25 32 Q35 28 45 32',
    rightEyebrow: 'M75 36 Q85 34 95 36',

    // Eyes - one winking
    leftEyeRy: 3,
    rightEyeRy: 12,

    // Mouth - tongue out
    mouth: 'M35 75 Q60 83 85 75',
    mouthFill: '',
    mouthFillOpacity: 0,

    teethOpacity: 0,
    tongueOpacity: 1
  },

  angry: {
    // Eyebrows - sharp angle down
    leftEyebrow: 'M25 38 Q35 33 45 30',
    rightEyebrow: 'M75 30 Q85 33 95 38',

    // Eyes - narrowed
    leftEyeRy: 6,
    rightEyeRy: 6,

    // Mouth - frown
    mouth: 'M35 85 Q60 75 85 85',
    mouthFill: '',
    mouthFillOpacity: 0,

    teethOpacity: 0,
    tongueOpacity: 0
  },

  surprised: {
    // Eyebrows - very high
    leftEyebrow: 'M23 25 Q35 22 47 25',
    rightEyebrow: 'M73 25 Q85 22 97 25',

    // Eyes - very wide
    leftEyeRy: 16,
    rightEyeRy: 16,

    // Mouth - O shape
    mouth: 'M50 75 Q50 90 60 90 Q70 90 70 75 Q70 65 60 65 Q50 65 50 75',
    mouthFill: 'M50 75 Q50 90 60 90 Q70 90 70 75 Q70 65 60 65 Q50 65 50 75',
    mouthFillOpacity: 1,

    teethOpacity: 0,
    tongueOpacity: 0
  },

  singing: {
    // Eyebrows - raised and soft
    leftEyebrow: 'M25 32 Q35 29 45 32',
    rightEyebrow: 'M75 32 Q85 29 95 32',

    // Eyes - gentle squint
    leftEyeRy: 10,
    rightEyeRy: 10,

    // Mouth - open oval for singing
    mouth: 'M40 72 Q45 92 60 95 Q75 92 80 72',
    mouthFill: 'M40 72 Q45 92 60 95 Q75 92 80 72 Q75 78 60 80 Q45 78 40 72',
    mouthFillOpacity: 1,

    teethOpacity: 0,
    tongueOpacity: 0
  }
};

/**
 * Set facial expression with smooth animation
 * @param {string} expression - Expression name
 * @param {number} duration - Animation duration in ms
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
    targets: '#leftEyeShape',
    ry: exp.leftEyeRy,
    duration,
    easing: 'easeOutQuad'
  });

  anime({
    targets: '#rightEyeShape',
    ry: exp.rightEyeRy,
    duration,
    easing: 'easeOutQuad'
  });

  // Animate mouth
  anime({
    targets: '#mouth',
    d: exp.mouth,
    duration,
    easing: 'easeOutElastic(1, .8)'
  });

  // Animate mouth fill
  anime({
    targets: '#mouthFill',
    d: exp.mouthFill,
    opacity: exp.mouthFillOpacity,
    duration,
    easing: 'easeOutQuad'
  });

  // Animate teeth visibility
  anime({
    targets: '#teeth',
    opacity: exp.teethOpacity,
    duration: duration * 0.5,
    easing: 'easeOutQuad'
  });

  // Animate tongue visibility
  anime({
    targets: '#tongue',
    opacity: exp.tongueOpacity,
    duration: duration * 0.5,
    easing: 'easeOutQuad'
  });

  console.log(`Expression set to: ${expression}`);
}

/**
 * Perform a blink animation
 */
export function blink() {
  const timeline = anime.timeline({
    easing: 'easeInOutQuad'
  });

  // Close eyes
  timeline.add({
    targets: ['#leftEyeShape', '#rightEyeShape'],
    ry: 2,
    duration: 100
  });

  // Open eyes
  timeline.add({
    targets: '#leftEyeShape',
    ry: EXPRESSIONS[currentExpression].leftEyeRy,
    duration: 150
  }, 100);

  timeline.add({
    targets: '#rightEyeShape',
    ry: EXPRESSIONS[currentExpression].rightEyeRy,
    duration: 150
  }, 100);
}

/**
 * Wink (left eye only)
 */
export function wink() {
  const timeline = anime.timeline({
    easing: 'easeInOutQuad'
  });

  timeline.add({
    targets: '#leftEyeShape',
    ry: 2,
    duration: 100
  });

  timeline.add({
    targets: '#leftEyeShape',
    ry: EXPRESSIONS[currentExpression].leftEyeRy,
    duration: 200
  }, 300);
}

/**
 * Look at a point (move pupils)
 * @param {number} x - X coordinate (0-100)
 * @param {number} y - Y coordinate (0-100)
 */
export function lookAt(x, y) {
  const offsetX = Math.max(-5, Math.min(5, (x - 50) * 0.1));
  const offsetY = Math.max(-5, Math.min(5, (y - 50) * 0.1));

  anime({
    targets: ['#leftPupil', '#leftShine'],
    cx: 35 + offsetX,
    cy: 45 + offsetY,
    duration: 300,
    easing: 'easeOutQuad'
  });

  anime({
    targets: ['#rightPupil', '#rightShine'],
    cx: 85 + offsetX,
    cy: 45 + offsetY,
    duration: 300,
    easing: 'easeOutQuad'
  });
}

/**
 * Reset pupils to center
 */
export function lookCenter() {
  anime({
    targets: ['#leftPupil', '#leftShine'],
    cx: [35, 37],
    cy: [45, 43],
    duration: 400,
    easing: 'easeOutQuad'
  });

  anime({
    targets: ['#rightPupil', '#rightShine'],
    cx: [85, 87],
    cy: [45, 43],
    duration: 400,
    easing: 'easeOutQuad'
  });
}

/**
 * Start automatic blinking and looking around
 */
export function startBlinking() {
  if (blinkInterval) return;

  // Blink every 3-5 seconds
  blinkInterval = setInterval(() => {
    const delay = 3000 + Math.random() * 2000;
    setTimeout(blink, delay);
  }, 5000);

  // Look around every 2-4 seconds
  lookAroundInterval = setInterval(() => {
    const randomX = 30 + Math.random() * 40;
    const randomY = 30 + Math.random() * 40;
    lookAt(randomX, randomY);

    setTimeout(() => {
      lookCenter();
    }, 1000 + Math.random() * 1000);
  }, 2000 + Math.random() * 2000);
}

/**
 * Stop automatic animations
 */
export function stopBlinking() {
  if (blinkInterval) {
    clearInterval(blinkInterval);
    blinkInterval = null;
  }

  if (lookAroundInterval) {
    clearInterval(lookAroundInterval);
    lookAroundInterval = null;
  }
}

/**
 * Detect sentiment from AI text and set expression
 * @param {string} text - AI response text
 * @returns {string} - Expression name
 */
export function expressFromText(text) {
  const lower = text.toLowerCase();

  // Detect singing
  if (lower.match(/♪|♫/) || lower.includes('la la') || lower.includes('tra la')) {
    setExpression('singing');
    return 'singing';
  }

  // Detect laughter
  if (lower.match(/hahaha|hehehehe|😂|🤣/) || lower.includes('hilarious')) {
    setExpression('laugh');
    return 'laugh';
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
 * Dynamic mouth animation during speech (syncs with audio amplitude)
 * @param {number} amplitude - Audio amplitude (0-1)
 */
export function animateSpeechMouth(amplitude) {
  const exp = EXPRESSIONS[currentExpression];

  if (amplitude > 0.3) {
    // Wide open
    const openMouth = 'M32 72 Q60 100 88 72';
    anime({
      targets: '#mouth',
      d: openMouth,
      duration: 100,
      easing: 'easeOutQuad'
    });
  } else if (amplitude > 0.1) {
    // Medium
    anime({
      targets: '#mouth',
      d: exp.mouth,
      duration: 150,
      easing: 'easeOutQuad'
    });
  } else {
    // Back to expression default
    anime({
      targets: '#mouth',
      d: exp.mouth,
      duration: 200,
      easing: 'easeOutQuad'
    });
  }
}
