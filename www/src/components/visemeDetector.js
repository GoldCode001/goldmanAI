/**
 * Viseme/Phoneme Detector
 * Analyzes text to determine mouth shapes for lip sync
 */

// Map phonemes to viseme shapes
const PHONEME_TO_VISEME = {
  // Closed (M, B, P)
  'm': 'closed', 'b': 'closed', 'p': 'closed',
  // Wide (E, I)
  'e': 'wide', 'i': 'wide', 'y': 'wide',
  // Open (A, O)
  'a': 'open', 'o': 'open', 'u': 'open',
  // F/V (teeth on lip)
  'f': 'teeth', 'v': 'teeth',
  // Th (tongue)
  'th': 'tongue',
  // Default
  'default': 'neutral'
};

/**
 * Detect viseme from text
 * @param {string} text - Text being spoken
 * @param {number} position - Character position in text (0-1)
 * @returns {string} viseme type
 */
export function detectViseme(text, position = 0) {
  if (!text || text.length === 0) return 'neutral';
  
  // Get character at position
  const charIndex = Math.floor(position * text.length);
  const char = text[charIndex]?.toLowerCase() || '';
  
  // Check for specific phonemes
  if (['m', 'b', 'p'].includes(char)) {
    return 'closed';
  }
  
  if (['e', 'i', 'y'].includes(char)) {
    return 'wide';
  }
  
  if (['a', 'o', 'u'].includes(char)) {
    return 'open';
  }
  
  if (['f', 'v'].includes(char)) {
    return 'teeth';
  }
  
  // Check for "th" sound
  if (charIndex < text.length - 1) {
    const twoChars = text.substring(charIndex, charIndex + 2).toLowerCase();
    if (twoChars === 'th') {
      return 'tongue';
    }
  }
  
  // Vowels generally = open
  if (/[aeiou]/.test(char)) {
    return 'open';
  }
  
  // Consonants = neutral/closed
  if (/[bcdfghjklmnpqrstvwxyz]/.test(char)) {
    return 'neutral';
  }
  
  return 'neutral';
}

/**
 * Detect if text contains laughter
 * @param {string} text - Text to analyze
 * @returns {boolean}
 */
export function detectLaughter(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  
  // Laughter patterns
  const laughterPatterns = [
    /hahaha/i,
    /hehehe/i,
    /lol/i,
    /lmao/i,
    /rofl/i,
    /😂/,
    /🤣/,
    /😆/,
    /hilarious/i,
    /too funny/i,
    /that's funny/i
  ];
  
  return laughterPatterns.some(pattern => pattern.test(lower));
}

/**
 * Get current word being spoken
 * @param {string} text - Full text
 * @param {number} progress - Progress through text (0-1)
 * @returns {string} current word
 */
export function getCurrentWord(text, progress) {
  if (!text) return '';
  
  const words = text.split(/\s+/);
  const wordIndex = Math.floor(progress * words.length);
  return words[wordIndex] || '';
}
