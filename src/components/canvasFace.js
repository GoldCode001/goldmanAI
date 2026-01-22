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
  visemeShape: 'neutral', // Current viseme shape
};

let currentMood = 'NEUTRAL';
let audioLevel = 0;
let isConnected = false;
let mousePos = { x: 0, y: 0 };
let currentText = ''; // Current text being spoken
let speechProgress = 0; // Progress through current text (0-1)
let isLaughing = false; // Laughter state
let currentViseme = 'neutral'; // Current mouth shape

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
export function updateFaceState(mood, audioLevelValue, connected, text = '', progress = 0) {
  currentMood = mood || 'NEUTRAL';
  audioLevel = audioLevelValue || 0;
  isConnected = connected || false;
  currentText = text || '';
  speechProgress = progress || 0;
  
  // Detect laughter (synchronous check)
  if (text) {
    const lower = text.toLowerCase();
    isLaughing = /hahaha|hehehe|😂|🤣|hilarious|too funny/i.test(lower);
  } else {
    isLaughing = false;
  }
  
  // Update viseme based on current text position (synchronous for performance)
  if (text && progress > 0) {
    // Simple viseme detection without async import
    const charIndex = Math.floor(progress * text.length);
    const char = text[charIndex]?.toLowerCase() || '';
    
    if (['m', 'b', 'p'].includes(char)) {
      currentViseme = 'closed';
    } else if (['e', 'i', 'y'].includes(char)) {
      currentViseme = 'wide';
    } else if (['a', 'o', 'u'].includes(char)) {
      currentViseme = 'open';
    } else if (['f', 'v'].includes(char)) {
      currentViseme = 'teeth';
    } else if (charIndex < text.length - 1 && text.substring(charIndex, charIndex + 2).toLowerCase() === 'th') {
      currentViseme = 'tongue';
    } else if (/[aeiou]/.test(char)) {
      currentViseme = 'open';
    } else if (audioLevel > 0.1) {
      currentViseme = 'open';
    } else {
      currentViseme = 'neutral';
    }
  } else if (audioLevel > 0.1) {
    // Use audio level as fallback
    currentViseme = 'open';
  } else {
    currentViseme = 'neutral';
  }
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

    // Audio -> Jaw (base openness)
    const rawVolume = audioLevel || 0;
    let targetJaw = Math.min(rawVolume * 2.0, 1.0);
    
    // Laughter overrides - wide open mouth
    if (isLaughing) {
      targetJaw = Math.max(targetJaw, 0.8);
      state.smileIntensity = 1.0; // Maximum smile
      state.browY = -20; // Eyebrows raised high
      state.eyeSquish = 0.3; // Eyes squinted
    }
    
    state.jawOpenness += (targetJaw - state.jawOpenness) * 0.25;
    state.visemeShape = currentViseme;

    const isTalking = state.jawOpenness > 0.05;

    // Mood Targets (laughter overrides these)
    let targetSmile = 0.5;
    let targetBrowY = 0;
    let targetBrowAngle = 0;
    let targetEyeSquish = 0;

    if (isLaughing) {
      // Laughter animation
      targetSmile = 1.0;
      targetBrowY = -25; // Eyebrows way up
      targetEyeSquish = 0.4; // Eyes squinted
      targetBrowAngle = 0; // Neutral angle
    } else {
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

    // -- MOUTH (Viseme-based shapes) --
    const mouthY = centerY + 50 + state.lookY * 15 + (state.jawOpenness * 10);
    let mouthWidth = 150;
    let mouthHeight = 10;
    
    // Viseme-based mouth shapes
    const viseme = state.visemeShape || currentViseme;
    
    if (isLaughing) {
      // Laughter: Wide open, very wide smile
      mouthWidth = 200;
      mouthHeight = state.jawOpenness * 120;
      state.smileIntensity = 1.0;
    } else {
      switch (viseme) {
        case 'closed':
          // M, B, P - lips together
          mouthWidth = 120;
          mouthHeight = 5;
          break;
        case 'wide':
          // E, I - wide smile, less open
          mouthWidth = 180;
          mouthHeight = state.jawOpenness * 60;
          state.smileIntensity = Math.max(state.smileIntensity, 0.7);
          break;
        case 'open':
          // A, O, U - round open
          mouthWidth = 140 + (state.jawOpenness * 40);
          mouthHeight = state.jawOpenness * 100;
          break;
        case 'teeth':
          // F, V - teeth on lip
          mouthWidth = 130;
          mouthHeight = state.jawOpenness * 40;
          break;
        case 'tongue':
          // TH - tongue out slightly
          mouthWidth = 135;
          mouthHeight = state.jawOpenness * 70;
          break;
        default:
          // Neutral - default bowl shape
          mouthWidth = 150 + (state.jawOpenness * 30);
          mouthHeight = state.jawOpenness * 80;
      }
    }
    
    ctx.beginPath();
    
    const halfW = mouthWidth / 2;
    const topCurveY = mouthY + (state.smileIntensity > 0 ? 0 : -state.smileIntensity * 15);

    ctx.moveTo(centerX - halfW, mouthY);
    
    // Top lip shape
    if (state.smileIntensity >= 0) {
      if (isLaughing || viseme === 'wide') {
        // Wide smile - curved up
        ctx.quadraticCurveTo(centerX, mouthY - 10, centerX + halfW, mouthY);
      } else {
        // Neutral/flat
        ctx.lineTo(centerX + halfW, mouthY);
      }
    } else {
      // Frown
      ctx.quadraticCurveTo(centerX, topCurveY, centerX + halfW, mouthY);
    }

    // Bottom shape based on viseme
    const bowlDepth = Math.max(15, mouthHeight + (state.smileIntensity * 50));
    
    if (isLaughing) {
      // Laughter: Very wide U shape
      ctx.bezierCurveTo(
        centerX + halfW, mouthY + bowlDepth,
        centerX - halfW, mouthY + bowlDepth,
        centerX - halfW, mouthY
      );
    } else if (viseme === 'open' || viseme === 'tongue') {
      // Round open shape (O, A, U)
      ctx.bezierCurveTo(
        centerX + halfW * 0.7, mouthY + bowlDepth,
        centerX - halfW * 0.7, mouthY + bowlDepth,
        centerX - halfW, mouthY
      );
    } else if (viseme === 'wide') {
      // Wide smile (E, I)
      ctx.bezierCurveTo(
        centerX + halfW, mouthY + bowlDepth * 0.6,
        centerX - halfW, mouthY + bowlDepth * 0.6,
        centerX - halfW, mouthY
      );
    } else if (state.smileIntensity < -0.2) {
      // Frown
      ctx.quadraticCurveTo(centerX, mouthY - bowlDepth, centerX - halfW, mouthY);
    } else {
      // Default bowl shape
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
