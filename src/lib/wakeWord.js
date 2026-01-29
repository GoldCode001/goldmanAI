/**
 * Wake Word Detection for PAL
 * Uses Web Speech API to listen for "Hey PAL" (or custom wake phrase)
 * Triggers PAL activation when detected
 */

let recognition = null;
let isListening = false;
let onWakeWordDetected = null;
let wakePhrase = 'hey pal'; // Default wake phrase

/**
 * Initialize wake word detection
 * @param {Object} options - { onDetected, customPhrase }
 */
export function initWakeWord(options = {}) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    console.warn('[WakeWord] Web Speech API not supported');
    return false;
  }

  onWakeWordDetected = options.onDetected;

  if (options.customPhrase) {
    wakePhrase = options.customPhrase.toLowerCase();
  }

  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';
  recognition.maxAlternatives = 3;

  recognition.onresult = (event) => {
    // Check all results for wake word
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];

      // Check all alternatives
      for (let j = 0; j < result.length; j++) {
        const transcript = result[j].transcript.toLowerCase().trim();

        // Check for wake phrase
        if (containsWakePhrase(transcript)) {
          console.log('[WakeWord] Detected:', transcript);

          // Stop listening temporarily to prevent double-triggers
          stopWakeWordListening();

          // Trigger callback
          if (onWakeWordDetected) {
            onWakeWordDetected(transcript);
          }

          return;
        }
      }
    }
  };

  recognition.onerror = (event) => {
    console.warn('[WakeWord] Error:', event.error);

    // Auto-restart on ALL errors except 'not-allowed' (permission denied)
    if (event.error !== 'not-allowed') {
      if (isListening) {
        setTimeout(() => {
          try {
            console.log('[WakeWord] Auto-restarting after error...');
            recognition.start();
          } catch (e) {
            console.warn('[WakeWord] Restart failed, will try again:', e.message);
            // Try again in 1 second if first restart fails
            setTimeout(() => {
              if (isListening) {
                try {
                  recognition.start();
                } catch (e2) {
                  console.error('[WakeWord] Second restart failed:', e2.message);
                }
              }
            }, 1000);
          }
        }, 100);
      }
    } else {
      console.error('[WakeWord] Microphone permission denied. Cannot restart.');
    }
  };

  recognition.onend = () => {
    console.log('[WakeWord] Recognition ended');
    // Auto-restart if we should still be listening
    if (isListening) {
      setTimeout(() => {
        try {
          console.log('[WakeWord] Restarting...');
          recognition.start();
        } catch (e) {
          console.warn('[WakeWord] Restart on end failed:', e.message);
        }
      }, 100);
    }
  };

  console.log('[WakeWord] Initialized with phrase:', wakePhrase);
  return true;
}

/**
 * Check if transcript contains wake phrase
 */
function containsWakePhrase(transcript) {
  // Normalize and check
  const normalized = transcript.toLowerCase().replace(/[^a-z\s]/g, '');

  // Check for exact phrase or variations
  const phrases = [
    wakePhrase,
    'hey pal',
    'hey paul', // Common misrecognition
    'hay pal',
    'hey pall',
    'a pal',
    'ok pal',
    'okay pal'
  ];

  for (const phrase of phrases) {
    if (normalized.includes(phrase)) {
      return true;
    }
  }

  return false;
}

/**
 * Start listening for wake word
 */
export function startWakeWordListening() {
  if (!recognition) {
    console.warn('[WakeWord] Not initialized');
    return false;
  }

  if (isListening) {
    console.log('[WakeWord] Already listening');
    return true;
  }

  try {
    recognition.start();
    isListening = true;
    console.log('[WakeWord] Started listening for:', wakePhrase);
    return true;
  } catch (e) {
    console.error('[WakeWord] Failed to start:', e);
    return false;
  }
}

/**
 * Stop listening for wake word
 */
export function stopWakeWordListening() {
  if (!recognition) return;

  isListening = false;

  try {
    recognition.stop();
    console.log('[WakeWord] Stopped listening');
  } catch (e) {
    // Ignore
  }
}

/**
 * Update wake phrase (e.g., when user changes AI name)
 */
export function setWakePhrase(phrase) {
  if (phrase) {
    wakePhrase = `hey ${phrase.toLowerCase()}`;
    console.log('[WakeWord] Updated phrase to:', wakePhrase);
  }
}

/**
 * Check if wake word listening is active
 */
export function isWakeWordActive() {
  return isListening;
}

export default {
  initWakeWord,
  startWakeWordListening,
  stopWakeWordListening,
  setWakePhrase,
  isWakeWordActive
};
