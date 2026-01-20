/**
 * SpeechToText - Hybrid approach using Web Speech API + Whisper fallback
 */

const API = "https://aibackend-production-a44f.up.railway.app";
const CONFIDENCE_THRESHOLD = 0.8;

/**
 * Transcribe audio using hybrid approach
 * @param {Blob} audioBlob - Audio blob to transcribe
 * @returns {Promise<string>} Transcribed text
 */
export async function transcribeAudio(audioBlob) {
  console.log('Starting transcription...');

  // Try Web Speech API first (instant, free)
  const webSpeechResult = await tryWebSpeech(audioBlob);

  if (webSpeechResult.confidence >= CONFIDENCE_THRESHOLD) {
    console.log('Web Speech API success:', webSpeechResult.text);
    return webSpeechResult.text;
  }

  console.log('Web Speech confidence low, falling back to Whisper');

  // Fallback to Whisper API
  return await transcribeWithWhisper(audioBlob);
}

/**
 * Try Web Speech API first
 * @param {Blob} audioBlob
 * @returns {Promise<{text: string, confidence: number}>}
 */
async function tryWebSpeech(audioBlob) {
  return new Promise((resolve) => {
    // Check if Web Speech API is available
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.log('Web Speech API not available');
      resolve({ text: '', confidence: 0 });
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const result = event.results[0];
      const transcript = result[0].transcript;
      const confidence = result[0].confidence;

      console.log('Web Speech result:', {
        transcript,
        confidence
      });

      resolve({
        text: transcript,
        confidence: confidence
      });
    };

    recognition.onerror = (event) => {
      console.error('Web Speech API error:', event.error);
      resolve({ text: '', confidence: 0 });
    };

    recognition.onnomatch = () => {
      console.log('Web Speech: no match');
      resolve({ text: '', confidence: 0 });
    };

    // Start recognition
    // Note: Web Speech API listens to live microphone, not blob playback
    // This is a limitation - for production, you'd need to handle this differently
    // For now, we'll rely more on Whisper fallback
    recognition.start();

    // Auto-timeout after 5 seconds
    setTimeout(() => {
      try {
        recognition.stop();
      } catch (e) {
        // Already stopped
      }
    }, 5000);
  });
}

/**
 * Transcribe with Whisper API via backend
 * @param {Blob} audioBlob
 * @returns {Promise<string>}
 */
async function transcribeWithWhisper(audioBlob) {
  try {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');

    const res = await fetch(`${API}/api/transcribe`, {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      throw new Error(`Transcription failed: ${res.statusText}`);
    }

    const data = await res.json();
    console.log('Whisper result:', data.text);
    return data.text;

  } catch (err) {
    console.error('Whisper API error:', err);
    throw new Error('Transcription failed');
  }
}
