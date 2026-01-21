/**
 * Speech Enhancer - Makes AI text sound more natural when spoken
 * Adds pauses, emphasis, and human-like patterns
 */

/**
 * Enhance text for more natural TTS output
 * @param {string} text - Original AI response
 * @returns {string} Enhanced text with natural speech patterns
 */
export function enhanceForSpeech(text) {
  let enhanced = text;

  // Add pauses after punctuation for breathing
  enhanced = enhanced.replace(/\. /g, '... '); // Longer pause after sentences
  enhanced = enhanced.replace(/\! /g, '!... '); // Pause after excitement
  enhanced = enhanced.replace(/\? /g, '?.. '); // Medium pause after questions
  enhanced = enhanced.replace(/\, /g, ', '); // Keep commas natural

  // Detect laughter and enhance it
  enhanced = enhanced.replace(/haha/gi, (match) => {
    return match.toLowerCase() === 'haha' ? 'ha ha ha' : 'HA HA HA';
  });
  enhanced = enhanced.replace(/hahaha/gi, 'ha ha ha ha ha');
  enhanced = enhanced.replace(/hehe/gi, 'heh heh heh');

  // Detect singing and add melodic pauses
  enhanced = enhanced.replace(/(♪|♫)([^♪♫]+)(♪|♫)/g, (match, open, lyrics, close) => {
    // Add slight pauses between sung phrases
    const melodic = lyrics.trim().replace(/ /g, '~ ');
    return `${open} ${melodic} ${close}`;
  });

  // Add emphasis to excited words (all caps)
  enhanced = enhanced.replace(/\b([A-Z]{3,})\b/g, (match) => {
    // Deepgram emphasizes louder when repeated
    return match.split('').join(' ');
  });

  // Add natural fillers at sentence starts (occasional)
  const fillers = ['Well, ', 'So, ', 'Hmm, ', 'Oh, ', 'Yeah, '];
  enhanced = enhanced.replace(/^([A-Z])/g, (match) => {
    // 30% chance to add filler
    if (Math.random() < 0.3) {
      const filler = fillers[Math.floor(Math.random() * fillers.length)];
      return filler + match.toLowerCase();
    }
    return match;
  });

  // Replace multiple exclamation marks with emphasis
  enhanced = enhanced.replace(/(!{2,})/g, '!');

  return enhanced;
}

/**
 * Detect emotion from text for expression sync
 * @param {string} text
 * @returns {string} emotion type
 */
export function detectEmotion(text) {
  const lower = text.toLowerCase();

  if (lower.match(/♪|♫/)) return 'singing';
  if (lower.match(/hahaha|hehehehe/)) return 'laughing';
  if (lower.match(/haha|hehe|lol/)) return 'playful';
  if (lower.match(/!{2,}/)) return 'excited';
  if (lower.includes('?')) return 'curious';

  return 'neutral';
}
