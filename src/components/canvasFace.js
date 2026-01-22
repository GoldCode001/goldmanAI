/**
 * Canvas-based PAL Face Component
 * Converted from React/TypeScript to vanilla JavaScript
 * Based on: geminiapp/hooks/usePalFaceLogic.ts
 */

let canvas = null;
let ctx = null;
let frameId = null;
let timeRef = 0;

// Physics/Animation State
const animState = {
  // Eyes
  eyeHeight: 120,
  eyeWidth: 45,
  eyeSquish: 0,
  blinkState: 0, // 0:open, 1:closing, 2:opening
  blinkProgress: 0,
  
  lookX: 0,
  lookY: 0,
  
  // Eyebrows
  browY: 0,
  browAngle: 0,

  // Mouth
  jawOpenness: 0,
  smileIntensity: 0,
};

let currentMood = 'NEUTRAL';
let audioLevel = 0;
let isConnected = false;
let mousePos = { x: 0, y: 0 };

/**
 * Initialize canvas face
 */
export function initCanvasFace() {
  // Wait a bit to ensure DOM is ready
  setTimeout(() => {
    canvas = document.getElementById('palCanvas');
    if (!canvas) {
      console.error('Canvas element not found - make sure mainApp is visible');
      return;
    }

    ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Could not get 2D context');
      return;
    }

    // Handle resize
    const resizeHandler = () => {
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', resizeHandler);
    resizeHandler();

    // Track mouse for eye following
    document.addEventListener('mousemove', (e) => {
      mousePos.x = e.clientX;
      mousePos.y = e.clientY;
    });

    console.log('Canvas face initialized');
    // Start render loop
    render();
  }, 100);
}

/**
 * Update face state
 */
export function updateFaceState(mood, audioLevelValue, connected) {
  currentMood = mood || 'NEUTRAL';
  audioLevel = audioLevelValue || 0;
  isConnected = connected || false;
}

/**
 * Main render loop
 */
function render() {
  if (!canvas || !ctx) {
    console.error('Canvas or context not available');
    return;
  }

  try {
    timeRef += 0.05;
    const w = canvas.width;
    const h = canvas.height;
    const centerX = w / 2;
    const centerY = h / 2;
    const state = animState;
  
  // --- 1. Physics & Logic ---

  // Audio -> Jaw
  const rawVolume = audioLevel || 0;
  const targetJaw = Math.min(rawVolume * 2.0, 1.0);
  state.jawOpenness += (targetJaw - state.jawOpenness) * 0.25;

  const isTalking = state.jawOpenness > 0.05;

  // Mood Targets
  let targetSmile = 0.5;
  let targetBrowY = 0;
  let targetBrowAngle = 0;
  let targetEyeSquish = 0;

  switch (currentMood) {
    case 'HAPPY':
      targetSmile = 1.0;
      targetBrowY = -15;
      targetEyeSquish = 0.05;
      break;
    case 'ANGRY':
      targetSmile = -0.5;
      targetBrowY = 20;
      targetBrowAngle = 0.4;
      break;
    case 'CONFUSED':
      targetSmile = 0;
      targetBrowAngle = -0.2;
      break;
    case 'THINKING':
      targetSmile = 0.2;
      targetBrowY = 10;
      break;
    default:
      targetSmile = 0.3;
  }

  // Physics Interpolation
  state.smileIntensity += (targetSmile - state.smileIntensity) * 0.1;
  state.browY += (targetBrowY - state.browY) * 0.1;
  state.browAngle += (targetBrowAngle - state.browAngle) * 0.1;
  state.eyeSquish += (targetEyeSquish - state.eyeSquish) * 0.1;

  // Look Tracking (Dampened)
  const targetLookX = (mousePos.x - centerX) / (w * 0.5);
  const targetLookY = (mousePos.y - centerY) / (h * 0.5);
  state.lookX += (targetLookX - state.lookX) * 0.1;
  state.lookY += (targetLookY - state.lookY) * 0.1;

  // Blinking
  if (state.blinkState === 0) {
    if (Math.random() < 0.005) state.blinkState = 1;
  } else if (state.blinkState === 1) {
    state.blinkProgress += 0.15;
    if (state.blinkProgress >= 1) {
      state.blinkProgress = 1;
      state.blinkState = 2;
    }
  } else {
    state.blinkProgress -= 0.15;
    if (state.blinkProgress <= 0) {
      state.blinkProgress = 0;
      state.blinkState = 0;
    }
  }

  // --- 2. Drawing Background ---
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, w, h);

  // Subtle Grid
  if (isConnected) {
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const gridSize = 40;
    for (let x = 0; x < w; x += gridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let y = 0; y < h; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();
  }

  // Vignette
  const gradVignette = ctx.createRadialGradient(centerX, centerY, h * 0.4, centerX, centerY, h * 1.2);
  gradVignette.addColorStop(0, 'rgba(0,0,0,0)');
  gradVignette.addColorStop(1, 'rgba(0,0,0,0.8)');
  ctx.fillStyle = gradVignette;
  ctx.fillRect(0, 0, w, h);

  // --- 3. Drawing Face ---
  
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#FFFFFF';
  
  // Dynamic Glow based on talking
  const glowIntensity = 20 + (state.jawOpenness * 30);
  ctx.shadowColor = 'rgba(255, 255, 255, 0.9)';
  ctx.shadowBlur = glowIntensity;
  
  // -- EYES (Pill Shapes) --
  const eyeSpacing = 130;
  const eyeBaseW = state.eyeWidth;
  const eyeBaseH = state.eyeHeight;
  const eyeY = centerY - 90 + state.lookY * 20;
  
  const currentEyeH = eyeBaseH * (1 - state.blinkProgress) * (1 - state.eyeSquish);
  
  const drawEye = (x, isRight) => {
    ctx.save();
    ctx.translate(x, eyeY);
    ctx.translate(state.lookX * 15, state.lookY * 15);
    
    const rotDir = isRight ? -1 : 1;
    ctx.rotate(state.browAngle * rotDir * 0.5);

    ctx.beginPath();
    const radius = Math.min(eyeBaseW, currentEyeH) / 2;
    
    if (currentEyeH < 4) {
      ctx.fillRect(-eyeBaseW/2, -2, eyeBaseW, 4);
    } else {
      // Draw rounded rectangle manually
      const x = -eyeBaseW/2;
      const y = -currentEyeH/2;
      const w = eyeBaseW;
      const h = currentEyeH;
      
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + w - radius, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
      ctx.lineTo(x + w, y + h - radius);
      ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
      ctx.lineTo(x + radius, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  };

  drawEye(centerX - eyeSpacing / 2, false);
  drawEye(centerX + eyeSpacing / 2, true);

  // -- EYEBROWS --
  const browSpacing = 130;
  const browYBase = centerY - 180 + state.lookY * 20 + state.browY;
  
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  
  const drawBrow = (x, isRight) => {
    ctx.save();
    ctx.translate(x, browYBase);
    
    const angle = isRight ? -state.browAngle : state.browAngle;
    ctx.rotate(angle);
    
    ctx.beginPath();
    if (currentMood === 'ANGRY') {
      ctx.moveTo(-30, 10);
      ctx.lineTo(30, -5);
    } else if (currentMood === 'CONFUSED' && isRight) {
      ctx.arc(0, 10, 30, Math.PI, 0);
    } else {
      ctx.arc(0, 20, 30, Math.PI * 1.25, Math.PI * 1.75);
    }
    ctx.stroke();
    ctx.restore();
  };

  drawBrow(centerX - browSpacing / 2, false);
  drawBrow(centerX + browSpacing / 2, true);

  // -- MOUTH (Bowl Shape) --
  const mouthY = centerY + 50 + state.lookY * 15 + (state.jawOpenness * 10);
  const mouthWidth = 150 + (state.jawOpenness * 30);
  
  const baseMouthHeight = 10;
  const openHeight = state.jawOpenness * 110;
  
  ctx.beginPath();
  
  const halfW = mouthWidth / 2;
  const topCurveY = mouthY + (state.smileIntensity > 0 ? 0 : -state.smileIntensity * 15);

  ctx.moveTo(centerX - halfW, mouthY);
  
  if (state.smileIntensity >= 0) {
    ctx.lineTo(centerX + halfW, mouthY);
  } else {
    ctx.quadraticCurveTo(centerX, topCurveY, centerX + halfW, mouthY);
  }

  const bowlDepth = Math.max(15, openHeight + (state.smileIntensity * 50));
  
  if (state.smileIntensity < -0.2) {
    ctx.quadraticCurveTo(centerX, mouthY - bowlDepth, centerX - halfW, mouthY);
  } else {
    ctx.bezierCurveTo(
      centerX + halfW, mouthY + bowlDepth,
      centerX - halfW, mouthY + bowlDepth,
      centerX - halfW, mouthY
    );
  }
  
    ctx.closePath();
    ctx.fill();

    // Reset shadow
    ctx.shadowBlur = 0;

    frameId = requestAnimationFrame(render);
  } catch (err) {
    console.error('Error in render loop:', err);
    // Continue render loop even if there's an error
    frameId = requestAnimationFrame(render);
  }
}

/**
 * Cleanup
 */
export function destroyCanvasFace() {
  if (frameId) {
    cancelAnimationFrame(frameId);
    frameId = null;
  }
}
