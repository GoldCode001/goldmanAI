/**
 * TextToSpeech - Convert text to speech using ElevenLabs API
 */

// Get API key from environment or window (set by build process)
const ELEVENLABS_API_KEY = window.ELEVENLABS_API_KEY || import.meta.env?.VITE_ELEVENLABS_API_KEY || '';
const VOICE_ID = 'pNInz6obpgDQGcFmaJgB'; // Default calm voice

// Check if API key is configured
if (!ELEVENLABS_API_KEY) {
  console.warn('ElevenLabs API key not configured. TTS will not work.');
}

/**
 * Convert text to speech using ElevenLabs
 * @param {string} text - Text to convert to speech
 * @returns {Promise<string>} Audio URL (blob URL)
 */
export async function speak(text) {
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5
        }
      })
    });

    if (!res.ok) {
      throw new Error(`ElevenLabs API failed: ${res.statusText}`);
    }

    const audioBlob = await res.blob();
    const audioUrl = URL.createObjectURL(audioBlob);

    console.log('TTS audio generated');
    return audioUrl;

  } catch (err) {
    console.error('TTS error:', err);
    throw new Error('Failed to generate speech');
  }
}

/**
 * Play audio and track amplitude for animation
 * @param {string} audioUrl - Audio blob URL
 * @param {Function} onAmplitudeUpdate - Callback with normalized amplitude (0-1)
 * @returns {Promise<void>} Resolves when audio finishes playing
 */
export async function playAudio(audioUrl, onAmplitudeUpdate) {
  return new Promise((resolve, reject) => {
    const audio = new Audio(audioUrl);

    // Create audio context for amplitude analysis
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaElementSource(audio);
    const analyser = audioContext.createAnalyser();

    source.connect(analyser);
    analyser.connect(audioContext.destination);

    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    /**
     * Update amplitude callback in animation loop
     */
    function updateAmplitude() {
      if (audio.paused || audio.ended) {
        return;
      }

      analyser.getByteFrequencyData(dataArray);

      // Calculate average amplitude
      const average = dataArray.reduce((a, b) => a + b, 0) / bufferLength;
      const normalized = average / 255; // Normalize to 0-1

      onAmplitudeUpdate(normalized);

      requestAnimationFrame(updateAmplitude);
    }

    audio.onplay = () => {
      console.log('Audio playback started');
      updateAmplitude();
    };

    audio.onended = () => {
      console.log('Audio playback ended');
      onAmplitudeUpdate(0); // Reset amplitude
      resolve();
    };

    audio.onerror = (err) => {
      console.error('Audio playback error:', err);
      reject(new Error('Audio playback failed'));
    };

    audio.play().catch(err => {
      console.error('Play failed:', err);
      reject(err);
    });
  });
}
