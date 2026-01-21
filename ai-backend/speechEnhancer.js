/**
 * Speech Enhancer - Makes AI text sound HUMAN when spoken
 * Uses natural pauses, varied pacing, and conversational rhythm
 */

/**
 * Enhance text for NATURAL TTS output (not robotic)
 * @param {string} text - Original AI response
 * @returns {string} Enhanced text with human-like speech patterns
 */
export function enhanceForSpeech(text) {
  let enhanced = text;

  // Step 1: Add LONG pauses after sentences (human breathing rhythm)
  enhanced = enhanced.replace(/\.\s+/g, '... ');

  // Step 2: Add pauses after questions (thinking pause)
  enhanced = enhanced.replace(/\?\s+/g, '?.. ');

  // Step 3: Add pauses after excitement
  enhanced = enhanced.replace(/!\s+/g, '!.. ');

  // Step 4: Add SHORT pauses after commas (natural breath)
  enhanced = enhanced.replace(/,\s+/g, ', ');

  // Step 5: Add pauses around "but", "and", "so" (conversational rhythm)
  enhanced = enhanced.replace(/\s+but\s+/gi, ', but, ');
  enhanced = enhanced.replace(/\s+and\s+/gi, ', and, ');
  enhanced = enhanced.replace(/\s+so\s+/gi, ', so, ');

  // Step 6: Slow down lists (add pauses between items)
  enhanced = enhanced.replace(/,\s+(\w)/g, (match, letter) => {
    return ', ' + letter; // Natural list pacing
  });

  // Step 7: Add thinking pauses before transitions
  const transitions = ['however', 'therefore', 'meanwhile', 'additionally', 'furthermore'];
  transitions.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    enhanced = enhanced.replace(regex, `... ${word}`);
  });

  // Step 8: Slow down technical terms (spell out acronyms with spaces)
  enhanced = enhanced.replace(/\b([A-Z]{2,})\b/g, (match) => {
    // Don't break common words like "AI" or "OK"
    if (match === 'AI' || match === 'OK' || match === 'US') return match;
    return match.split('').join(' '); // "API" → "A P I"
  });

  // Step 9: Add emphasis to questions (raise pitch by repeating slightly)
  enhanced = enhanced.replace(/\?/g, '?');

  // Step 10: Natural conversational starters
  const starters = [
    { pattern: /^(Let me |I can |I will )/i, replacement: '$1, ' },
    { pattern: /^(Here's |Here are )/i, replacement: '... $1' },
    { pattern: /^(You know|Actually|Basically|Honestly)/i, replacement: '$1, ' }
  ];

  starters.forEach(({ pattern, replacement }) => {
    enhanced = enhanced.replace(pattern, replacement);
  });

  // Step 11: Fix laughter (space it out naturally)
  enhanced = enhanced.replace(/hahaha+/gi, 'ha ha ha');
  enhanced = enhanced.replace(/haha/gi, 'ha ha');
  enhanced = enhanced.replace(/hehe+/gi, 'heh heh');

  // Step 12: Add breath before long sentences (sentences over 15 words)
  const sentences = enhanced.split(/([.!?])/);
  enhanced = sentences.map((sentence, i) => {
    if (i % 2 === 0 && sentence.split(' ').length > 15) {
      return '... ' + sentence; // Add thinking pause before long thought
    }
    return sentence;
  }).join('');

  // Step 13: Vary sentence pacing (add micro-pauses mid-sentence occasionally)
  enhanced = enhanced.replace(/\s+(that|which|who|where|when)\s+/gi, ' $1 ');

  // Step 14: Remove multiple spaces
  enhanced = enhanced.replace(/\s{2,}/g, ' ');

  // Step 15: Remove emoji (TTS shouldn't read these)
  enhanced = enhanced.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');

  console.log('Speech enhanced - original length:', text.length, '→ enhanced:', enhanced.length);

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
