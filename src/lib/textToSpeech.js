/**
 * TextToSpeech - Convert text to speech via backend (secure)
 */

const API = "https://aibackend-production-a44f.up.railway.app";

/**
 * Convert text to speech using backend TTS endpoint (Streaming)
 * @param {string} text - Text to convert to speech
 * @returns {Promise<string>} Audio URL (blob URL) - kept for compatibility, but now streams internally if needed
 */
export async function speak(text) {
  try {
    const res = await fetch(`${API}/api/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text })
    });

    if (!res.ok) {
      throw new Error(`TTS API failed: ${res.statusText}`);
    }

    // For now, we still buffer the whole response because the browser's Audio element
    // doesn't easily support chunked transfer playback without MediaSource Extensions (MSE).
    // Implementing full MSE for WAV/MP3 is complex.
    // However, the backend is now streaming, so the Time-To-First-Byte is faster.
    // We can optimize this further later with a custom audio player.
    
    const audioBlob = await res.blob();
    const audioUrl = URL.createObjectURL(audioBlob);

    console.log('TTS audio generated (buffered stream)');
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
      
      // Ensure context is running (fixes potential cutoff on first play)
      if (audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
          console.log('AudioContext resumed');
          updateAmplitude();
        });
      } else {
        updateAmplitude();
      }
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
