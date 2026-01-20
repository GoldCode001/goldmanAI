/**
 * Voice Activity Detection (VAD)
 * Detects when user stops speaking using Web Speech API
 */

export class VoiceActivityDetector {
  constructor(onTranscript, onError) {
    this.recognition = null;
    this.isListening = false;
    this.onTranscript = onTranscript;
    this.onError = onError;
    this.finalTranscript = '';
    this.silenceTimer = null;
  }

  /**
   * Start listening continuously
   */
  start() {
    // Check if Web Speech API is available
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      this.onError('Web Speech API not available. Please use Chrome or Edge.');
      return false;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true; // Keep listening
    this.recognition.interimResults = true; // Get partial results
    this.recognition.lang = 'en-US';

    this.recognition.onstart = () => {
      console.log('VAD: Started listening');
      this.isListening = true;
      this.finalTranscript = '';
    };

    this.recognition.onresult = (event) => {
      let interimTranscript = '';

      // Process all results
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;

        if (event.results[i].isFinal) {
          this.finalTranscript += transcript + ' ';
          console.log('VAD: Final transcript chunk:', transcript);

          // User stopped speaking - start silence timer
          this.startSilenceTimer();
        } else {
          interimTranscript += transcript;
          console.log('VAD: Interim transcript:', transcript);
        }
      }
    };

    this.recognition.onerror = (event) => {
      console.error('VAD: Speech recognition error:', event.error);

      // Restart on certain errors
      if (event.error === 'no-speech' || event.error === 'audio-capture') {
        // These are recoverable, just restart
        console.log('VAD: Restarting after recoverable error');
        setTimeout(() => {
          if (this.isListening) {
            this.recognition.start();
          }
        }, 100);
      } else {
        this.onError(`Speech recognition error: ${event.error}`);
      }
    };

    this.recognition.onend = () => {
      console.log('VAD: Recognition ended');

      // If still supposed to be listening, restart
      if (this.isListening) {
        console.log('VAD: Auto-restarting...');
        setTimeout(() => {
          if (this.isListening) {
            try {
              this.recognition.start();
            } catch (e) {
              console.error('VAD: Failed to restart:', e);
            }
          }
        }, 100);
      }
    };

    try {
      this.recognition.start();
      return true;
    } catch (err) {
      console.error('VAD: Failed to start:', err);
      this.onError('Failed to start voice recognition');
      return false;
    }
  }

  /**
   * Start silence timer - triggers when user stops speaking
   */
  startSilenceTimer() {
    // Clear existing timer
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
    }

    // Wait 1.5 seconds of silence before processing
    this.silenceTimer = setTimeout(() => {
      if (this.finalTranscript.trim()) {
        console.log('VAD: Silence detected, sending transcript:', this.finalTranscript);
        this.onTranscript(this.finalTranscript.trim());
        this.finalTranscript = '';
      }
    }, 1500); // 1.5 second silence threshold
  }

  /**
   * Stop listening
   */
  stop() {
    console.log('VAD: Stopping');
    this.isListening = false;

    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {
        console.error('VAD: Error stopping:', e);
      }
    }

    // Send any remaining transcript
    if (this.finalTranscript.trim()) {
      this.onTranscript(this.finalTranscript.trim());
      this.finalTranscript = '';
    }
  }

  /**
   * Check if currently listening
   */
  isActive() {
    return this.isListening;
  }
}
