/**
 * AudioRecorder - Handles microphone access and audio recording
 */

export class AudioRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.stream = null;
  }

  /**
   * Initialize microphone and MediaRecorder
   */
  async init() {
    try {
      // Request microphone permission
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });

      this.mediaRecorder = new MediaRecorder(this.stream);

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          this.audioChunks.push(e.data);
        }
      };

      console.log('AudioRecorder initialized');
    } catch (err) {
      console.error('Failed to initialize AudioRecorder:', err);
      throw new Error('Microphone access denied');
    }
  }

  /**
   * Start recording audio
   */
  startRecording() {
    if (!this.mediaRecorder) {
      throw new Error('AudioRecorder not initialized');
    }

    this.audioChunks = [];
    this.mediaRecorder.start();
    console.log('Recording started');
  }

  /**
   * Stop recording and return audio blob
   * @returns {Promise<Blob>} Audio blob in webm format
   */
  stopRecording() {
    if (!this.mediaRecorder) {
      throw new Error('AudioRecorder not initialized');
    }

    return new Promise((resolve) => {
      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        console.log('Recording stopped, blob size:', audioBlob.size);
        resolve(audioBlob);
      };
      this.mediaRecorder.stop();
    });
  }

  /**
   * Cleanup resources and stop tracks
   */
  cleanup() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      console.log('AudioRecorder cleaned up');
    }
  }
}
