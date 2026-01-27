/**
 * Wake Word Detection
 * Listens for wake phrases like "Hey PAL" to activate the assistant
 * Uses Web Speech API for lightweight always-on listening
 */

// Default wake phrases (case insensitive)
const DEFAULT_WAKE_PHRASES = [
  'hey pal',
  'hey paul',  // Common misheard
  'hi pal',
  'ok pal',
  'okay pal'
];

// State
let recognition = null;
let isListening = false;
let wakePhrases = [...DEFAULT_WAKE_PHRASES];
let onWakeCallback = null;
let onStatusCallback = null;
let restartTimeout = null;
let consecutiveErrors = 0;
const MAX_CONSECUTIVE_ERRORS = 5;

/**
 * Check if wake word detection is supported
 */
export function isWakeWordSupported() {
  return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
}

/**
 * Initialize wake word detection
 * @param {Object} options Configuration options
 * @param {Function} options.onWake Callback when wake word is detected
 * @param {Function} options.onStatus Callback for status updates
 * @param {string[]} options.phrases Custom wake phrases
 */
export function initWakeWord(options = {}) {
  if (!isWakeWordSupported()) {
    console.warn('Wake word detection not supported in this browser');
    return false;
  }

  if (options.onWake) onWakeCallback = options.onWake;
  if (options.onStatus) onStatusCallback = options.onStatus;
  if (options.phrases) wakePhrases = options.phrases.map(p => p.toLowerCase());

  // Create recognition instance
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();

  // Configure for always-on listening
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';
  recognition.maxAlternatives = 3;

  // Handle results
  recognition.onresult = (event) => {
    const results = event.results;

    // Check both interim and final results
    for (let i = event.resultIndex; i < results.length; i++) {
      const result = results[i];

      // Check all alternatives
      for (let j = 0; j < result.length; j++) {
        const transcript = result[j].transcript.toLowerCase().trim();

        // Check if any wake phrase is present
        for (const phrase of wakePhrases) {
          if (transcript.includes(phrase)) {
            console.log(`Wake word detected: "${phrase}" in "${transcript}"`);

            // Notify callback
            if (onWakeCallback) {
              // Stop listening temporarily to allow main assistant to take over
              stopWakeWord();
              onWakeCallback({ phrase, transcript, confidence: result[j].confidence });
            }
            return;
          }
        }
      }
    }
  };

  // Handle errors
  recognition.onerror = (event) => {
    console.warn('Wake word recognition error:', event.error);

    // Ignore no-speech errors (normal when user isn't speaking)
    if (event.error === 'no-speech') {
      consecutiveErrors = 0;
      return;
    }

    // Ignore aborted errors (from stopping manually)
    if (event.error === 'aborted') {
      return;
    }

    consecutiveErrors++;

    if (onStatusCallback) {
      onStatusCallback({ status: 'error', error: event.error });
    }

    // Restart unless too many errors
    if (consecutiveErrors < MAX_CONSECUTIVE_ERRORS && isListening) {
      restartTimeout = setTimeout(() => {
        restartWakeWord();
      }, 1000);
    } else if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
      console.error('Too many consecutive errors, stopping wake word detection');
      if (onStatusCallback) {
        onStatusCallback({ status: 'stopped', reason: 'too_many_errors' });
      }
      isListening = false;
    }
  };

  // Auto-restart when recognition ends
  recognition.onend = () => {
    if (isListening) {
      // Small delay before restart to prevent rapid cycling
      restartTimeout = setTimeout(() => {
        restartWakeWord();
      }, 100);
    }
  };

  recognition.onstart = () => {
    consecutiveErrors = 0;
    if (onStatusCallback) {
      onStatusCallback({ status: 'listening' });
    }
  };

  return true;
}

/**
 * Start listening for wake word
 */
export function startWakeWord() {
  if (!recognition) {
    console.error('Wake word not initialized. Call initWakeWord() first.');
    return false;
  }

  if (isListening) {
    return true; // Already listening
  }

  try {
    isListening = true;
    recognition.start();
    console.log('Wake word detection started');
    return true;
  } catch (err) {
    console.error('Failed to start wake word detection:', err);
    isListening = false;
    return false;
  }
}

/**
 * Stop listening for wake word
 */
export function stopWakeWord() {
  if (!recognition) return;

  isListening = false;

  if (restartTimeout) {
    clearTimeout(restartTimeout);
    restartTimeout = null;
  }

  try {
    recognition.stop();
    console.log('Wake word detection stopped');
  } catch (err) {
    // Ignore errors when stopping
  }

  if (onStatusCallback) {
    onStatusCallback({ status: 'stopped' });
  }
}

/**
 * Restart wake word detection
 */
function restartWakeWord() {
  if (!isListening) return;

  try {
    recognition.start();
  } catch (err) {
    // If already running, stop and restart
    if (err.message?.includes('already started')) {
      return;
    }
    console.warn('Error restarting wake word:', err);
  }
}

/**
 * Resume wake word detection after main assistant finishes
 */
export function resumeWakeWord() {
  if (!recognition) return false;

  // Small delay to allow microphone to be released
  setTimeout(() => {
    startWakeWord();
  }, 500);

  return true;
}

/**
 * Update wake phrases
 */
export function setWakePhrases(phrases) {
  wakePhrases = phrases.map(p => p.toLowerCase());
}

/**
 * Get current wake phrases
 */
export function getWakePhrases() {
  return [...wakePhrases];
}

/**
 * Check if currently listening
 */
export function isWakeWordListening() {
  return isListening;
}

/**
 * Clean up resources
 */
export function destroyWakeWord() {
  stopWakeWord();
  recognition = null;
  onWakeCallback = null;
  onStatusCallback = null;
}

export default {
  isWakeWordSupported,
  initWakeWord,
  startWakeWord,
  stopWakeWord,
  resumeWakeWord,
  setWakePhrases,
  getWakePhrases,
  isWakeWordListening,
  destroyWakeWord
};
