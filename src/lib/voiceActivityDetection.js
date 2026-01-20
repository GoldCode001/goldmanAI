/**
 * Voice Activity Detection (VAD) using Whisper
 * Records audio in chunks and transcribes using Whisper API for better accuracy
 */

const API = "https://aibackend-production-a44f.up.railway.app";

export class VoiceActivityDetector {
  constructor(onTranscript, onError) {
    this.mediaRecorder = null;
    this.audioStream = null;
    this.isListening = false;
    this.onTranscript = onTranscript;
    this.onError = onError;
    this.audioChunks = [];
    this.recordingTimer = null;
    this.silenceDetector = null;
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
        if (this.audioChunks.length === 0) {
          console.log('VAD: No audio recorded');
          if (this.isListening) {
            this.startRecordingChunk();
          }
          return;
        }

        // Create blob from chunks
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        this.audioChunks = [];

        // Transcribe using Whisper
        try {
          const text = await this.transcribeAudio(audioBlob);

          if (text && text.trim()) {
            console.log('VAD: Transcribed:', text);
            this.onTranscript(text.trim());
          } else {
            console.log('VAD: No speech detected in chunk');
          }
        } catch (err) {
          console.error('VAD: Transcription failed:', err);
          // Don't call onError for transcription failures - just log and continue
        }

        // Continue listening if still active
        if (this.isListening) {
          this.startRecordingChunk();
        }
      };

      // Start recording first chunk
      this.isListening = true;
      this.startRecordingChunk();

      console.log('VAD: Started listening with Whisper');
      return true;

    } catch (err) {
      console.error('VAD: Failed to start:', err);
      this.onError('Microphone access denied or unavailable');
      return false;
    }
  }

  /**
   * Start recording a chunk (3-second intervals)
   */
  startRecordingChunk() {
    if (!this.mediaRecorder || !this.isListening) return;

    this.audioChunks = [];
    this.mediaRecorder.start();

    // Record for 3 seconds then process
    this.recordingTimer = setTimeout(() => {
      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.stop();
      }
    }, 3000); // 3-second chunks for responsive detection
  }

  /**
   * Transcribe audio using Whisper API
   */
  async transcribeAudio(audioBlob) {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'audio.webm');

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

    if (this.recordingTimer) {
      clearTimeout(this.recordingTimer);
      this.recordingTimer = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }

    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
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
