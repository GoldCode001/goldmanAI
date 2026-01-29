/**
 * Voice Activity Detection (VAD) using Whisper
 * Accumulates audio until silence is detected, then transcribes complete utterance
 */

const API = "https://aibackend-production-a44f.up.railway.app";

export class VoiceActivityDetector {
  constructor(onTranscript, onError, onSpeechStart) {
    this.mediaRecorder = null;
    this.audioStream = null;
    this.audioContext = null;
    this.analyser = null;
    this.isListening = false;
    this.onTranscript = onTranscript;
    this.onError = onError;
    this.onSpeechStart = onSpeechStart;
    this.audioChunks = [];
    this.silenceTimer = null;
    this.isSpeaking = false;
    this.isProcessing = false; // Prevent overlapping responses
    this.silenceCheckInterval = null;
  }

  /**
   * Start listening continuously with automatic silence detection
   */
  async start() {
    try {
      // Get microphone access
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Create audio context for silence detection
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = this.audioContext.createMediaStreamSource(this.audioStream);
      this.analyser = this.audioContext.createAnalyser();
      source.connect(this.analyser);

      this.analyser.fftSize = 2048;
      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      // Create media recorder
      this.mediaRecorder = new MediaRecorder(this.audioStream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        if (this.audioChunks.length === 0 || this.isProcessing) {
          console.log('VAD: No audio or already processing');
          this.audioChunks = [];
          return;
        }

        // Create blob from all accumulated chunks
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        this.audioChunks = [];

        // Prevent overlapping requests
        this.isProcessing = true;

        // Transcribe using Whisper
        try {
          const text = await this.transcribeAudio(audioBlob);

          if (text && text.trim()) {
            console.log('VAD: Complete transcription:', text);
            this.onTranscript(text.trim());
          } else {
            console.log('VAD: No speech detected');
          }
        } catch (err) {
          console.error('VAD: Transcription failed:', err);
          // Don't call onError for transcription failures - just log and continue
        } finally {
          this.isProcessing = false;
        }
      };

      // Start continuous recording
      this.isListening = true;
      this.mediaRecorder.start();

      // Check for silence every 100ms
      this.silenceCheckInterval = setInterval(() => {
        this.analyser.getByteTimeDomainData(dataArray);

        // Calculate audio level (0-255, 128 = silence)
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          const value = Math.abs(dataArray[i] - 128);
          sum += value;
        }
        const average = sum / bufferLength;

        const SPEECH_THRESHOLD = 5; // Adjust this value (higher = need louder speech)
        const isSpeechDetected = average > SPEECH_THRESHOLD;

        if (isSpeechDetected) {
          // User is speaking
          if (!this.isSpeaking) {
            console.log('VAD: Speech started');
            this.isSpeaking = true;
            if (this.onSpeechStart) {
              this.onSpeechStart();
            }
          }

          // Clear any pending silence timer
          if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
          }
        } else {
          // Silence detected
          if (this.isSpeaking && !this.silenceTimer && !this.isProcessing) {
            // Start silence timer (wait 2 seconds of silence before processing)
            this.silenceTimer = setTimeout(() => {
              console.log('VAD: Silence confirmed, processing audio');
              this.isSpeaking = false;

              // Stop and process accumulated audio
              if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                this.mediaRecorder.stop();

                // Restart recording immediately for next utterance
                setTimeout(() => {
                  if (this.isListening && this.mediaRecorder) {
                    this.audioChunks = [];
                    this.mediaRecorder.start();
                  }
                }, 100);
              }
            }, 2000); // 2.0 second silence threshold (increased from 1.5s)
          }
        }
      }, 100);

      console.log('VAD: Started continuous listening with silence detection');
      return true;

    } catch (err) {
      console.error('VAD: Failed to start:', err);
      this.onError('Microphone access denied or unavailable');
      return false;
    }
  }

  /**
   * Transcribe audio using Whisper API
   */
  async transcribeAudio(audioBlob, language = "en") {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'audio.webm');
    formData.append('language', language);

    const res = await fetch(`${API}/api/transcribe`, {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      throw new Error(`Transcription failed: ${res.status}`);
    }

    const data = await res.json();
    return data.text;
  }

  /**
   * Stop listening
   */
  stop() {
    console.log('VAD: Stopping');
    this.isListening = false;
    this.isSpeaking = false;
    this.isProcessing = false;

    if (this.silenceCheckInterval) {
      clearInterval(this.silenceCheckInterval);
      this.silenceCheckInterval = null;
    }

    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }

    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.audioChunks = [];
  }

  /**
   * Check if currently listening
   */
  isActive() {
    return this.isListening;
  }
}
