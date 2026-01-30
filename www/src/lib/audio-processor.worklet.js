/**
 * Audio Worklet Processor for Gemini Live
 * Captures microphone audio at 16kHz and converts to PCM Int16
 * Runs on separate audio thread for better performance and lower latency
 */

class GeminiAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 4096;
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];

    if (input.length > 0) {
      const channelData = input[0]; // Mono audio

      // Accumulate samples into buffer
      for (let i = 0; i < channelData.length; i++) {
        this.buffer[this.bufferIndex++] = channelData[i];

        // When buffer is full, send to main thread
        if (this.bufferIndex >= this.bufferSize) {
          // Convert Float32 to Int16 PCM
          const int16 = new Int16Array(this.bufferSize);
          for (let j = 0; j < this.bufferSize; j++) {
            int16[j] = Math.max(-32768, Math.min(32767, this.buffer[j] * 32768));
          }

          // Convert to base64 for Gemini
          const uint8 = new Uint8Array(int16.buffer);

          // Send to main thread
          this.port.postMessage({
            type: 'audio',
            data: uint8
          });

          // Reset buffer
          this.bufferIndex = 0;
        }
      }
    }

    // Keep processor alive
    return true;
  }
}

registerProcessor('gemini-audio-processor', GeminiAudioProcessor);
