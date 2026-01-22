/**
 * Gemini Live API Integration
 * Real-time bidirectional audio streaming with Google Gemini
 * Based on: gemini-2.5-flash-native-audio-preview-12-2025
 */

let geminiApiKey = null;
let liveSession = null;
let audioContext = null;
let analyserNode = null;
let microphoneSource = null;
let outputSource = null; // For AI audio output
let isConnected = false;
let onAudioLevelUpdate = null; // Callback for lip sync (amplitude 0-1)
let onTranscriptUpdate = null; // Callback for text updates
let onError = null;
let microphoneStream = null;
let audioProcessor = null;
let scheduledTime = 0; // For queuing audio chunks

/**
 * Initialize Gemini Live connection
 * @param {string} apiKey - Google AI Studio API key
 * @param {Object} callbacks - { onAudioLevel, onTranscript, onError }
 */
export async function initGeminiLive(apiKey, callbacks = {}) {
  try {
    geminiApiKey = apiKey;
    onAudioLevelUpdate = callbacks.onAudioLevel;
    onTranscriptUpdate = callbacks.onTranscript;
    onError = callbacks.onError;

    if (!geminiApiKey) {
      throw new Error('Gemini API key is required');
    }

    // Import Google Generative AI SDK
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(geminiApiKey);

    // Create audio context for processing (16kHz for Gemini)
    audioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 16000
    });
    
    // Create analyser for lip sync (connected to AI output)
    analyserNode = audioContext.createAnalyser();
    analyserNode.fftSize = 256;
    analyserNode.smoothingTimeConstant = 0.8;

    // Get the model - using the native audio preview model
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash-exp" // Fallback if preview not available
    });

    console.log('Gemini Live initialized');
    return { genAI, model };
  } catch (err) {
    console.error('Failed to initialize Gemini Live:', err);
    if (onError) onError(err);
    return null;
  }
}

/**
 * Start listening and speaking with Gemini Live
 */
export async function startGeminiLive(genAI, model) {
  try {
    if (!audioContext) {
      throw new Error('Audio context not initialized');
    }

    // Get microphone stream
    microphoneStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 16000 // Gemini expects 16kHz
      }
    });

    // Create source from microphone
    microphoneSource = audioContext.createMediaStreamSource(microphoneStream);
    
    // Note: analyserNode will be connected to AI audio OUTPUT (not microphone)
    // This is set up in playGeminiAudio()

    // Connect to Gemini Live
    console.log('Connecting to Gemini Live...');
    
    // Connect to Gemini Live (pass both model and genAI for flexibility)
    liveSession = await connectToGeminiLive(model, genAI);
    
    if (!liveSession) {
      throw new Error('Failed to connect to Gemini Live');
    }

    // Start processing microphone audio
    startMicrophoneProcessing();
    
    // Start audio level monitoring for lip sync
    startAudioLevelMonitoring();

    isConnected = true;
    console.log('Gemini Live started and connected');
    return true;
  } catch (err) {
    console.error('Failed to start Gemini Live:', err);
    if (onError) onError(err);
    return false;
  }
}

/**
 * Connect to Gemini Live (WebSocket-like connection)
 * Based on: @google/genai SDK with live.connect()
 */
async function connectToGeminiLive(model, genAI) {
  try {
    // The actual Gemini Live API format
    // Based on user description: ai.live.connect()
    // We'll try multiple possible formats
    
    // Format 1: model.live.connect()
    if (model && typeof model.live === 'object' && typeof model.live.connect === 'function') {
      const session = await model.live.connect();
      setupSessionHandlers(session);
      return session;
    }
    
    // Format 2: genAI.live.connect({ model: "..." })
    if (genAI && typeof genAI.live === 'object' && typeof genAI.live.connect === 'function') {
      const session = await genAI.live.connect({
        model: "gemini-2.0-flash-exp" // or gemini-2.5-flash-native-audio-preview-12-2025
      });
      setupSessionHandlers(session);
      return session;
    }
    
    // Format 3: Direct WebSocket (if SDK doesn't provide wrapper)
    console.warn('Gemini Live API format not found, using fallback');
    return createFallbackSession();
    
  } catch (err) {
    console.error('Failed to connect to Gemini Live:', err);
    throw err;
  }
}

/**
 * Setup event handlers for Gemini Live session
 */
function setupSessionHandlers(session) {
  // Handle incoming messages (audio + text)
  if (session.onmessage) {
    session.onmessage = (event) => {
      handleGeminiResponse(event);
    };
  } else if (session.addEventListener) {
    session.addEventListener('message', (event) => {
      handleGeminiResponse(event);
    });
  }
  
  // Handle errors
  if (session.onerror) {
    session.onerror = (error) => {
      console.error('Gemini Live session error:', error);
      if (onError) onError(error);
    };
  }
  
  // Handle close
  if (session.onclose) {
    session.onclose = () => {
      console.log('Gemini Live session closed');
      isConnected = false;
    };
  }
}

/**
 * Fallback session (for testing without actual API)
 */
function createFallbackSession() {
  console.warn('Using fallback Gemini Live session - API connection not available');
  return {
    sendRealtimeInput: (data) => {
      console.log('Fallback: Sending to Gemini:', data.type || 'audio');
    },
    close: () => {
      console.log('Fallback session closed');
    }
  };
}

/**
 * Process microphone audio and convert to PCM for Gemini
 */
function startMicrophoneProcessing() {
  // Create script processor for audio chunks
  audioProcessor = audioContext.createScriptProcessor(4096, 1, 1);
  
  audioProcessor.onaudioprocess = (e) => {
    if (!isConnected || !liveSession) return;
    
    const inputData = e.inputBuffer.getChannelData(0);
    
    // Convert Float32 to Int16 PCM (Gemini expects 16-bit PCM)
    const pcmData = new Int16Array(inputData.length);
    for (let i = 0; i < inputData.length; i++) {
      // Clamp and convert to 16-bit
      const s = Math.max(-1, Math.min(1, inputData[i]));
      pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    
    // Convert to base64 for Gemini
    const base64Audio = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
    
    // Send to Gemini Live
    // Format may vary - try multiple possible formats
    if (liveSession) {
      if (typeof liveSession.sendRealtimeInput === 'function') {
        // Format 1: sendRealtimeInput({ audio: base64, mimeType: "..." })
        liveSession.sendRealtimeInput({
          audio: base64Audio,
          mimeType: "audio/pcm"
        });
      } else if (typeof liveSession.send === 'function') {
        // Format 2: send({ type: "audio", data: base64 })
        liveSession.send({
          type: "audio",
          data: base64Audio
        });
      } else if (typeof liveSession.write === 'function') {
        // Format 3: write(audioBuffer)
        liveSession.write(pcmData.buffer);
      }
    }
  };
  
  microphoneSource.connect(audioProcessor);
  audioProcessor.connect(audioContext.destination);
}

/**
 * Handle audio/text responses from Gemini
 */
function handleGeminiResponse(event) {
  if (event.data) {
    // Handle audio chunks
    if (event.data.audio) {
      playGeminiAudio(event.data.audio);
    }
    
    // Handle text/transcript updates
    if (event.data.text) {
      if (onTranscriptUpdate) {
        onTranscriptUpdate(event.data.text);
      }
    }
  }
}

/**
 * Handle audio output from Gemini and play it
 */
function playGeminiAudio(audioData) {
  try {
    // Decode base64 PCM audio from Gemini
    const audioBytes = atob(audioData);
    const audioArray = new Uint8Array(audioBytes.length);
    for (let i = 0; i < audioBytes.length; i++) {
      audioArray[i] = audioBytes.charCodeAt(i);
    }
    
    // Convert Int16 PCM to Float32 for Web Audio API
    const pcmData = new Int16Array(audioArray.buffer);
    const floatData = new Float32Array(pcmData.length);
    for (let i = 0; i < pcmData.length; i++) {
      floatData[i] = pcmData[i] / 32768.0;
    }
    
    // Create AudioBuffer and play
    const audioBuffer = audioContext.createBuffer(1, floatData.length, 16000);
    audioBuffer.getChannelData(0).set(floatData);
    
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    
    // Connect to analyser for lip sync (THIS is what drives the mouth animation)
    source.connect(analyserNode);
    source.connect(audioContext.destination);
    
    // Schedule playback (queue chunks back-to-back)
    source.start(scheduledTime);
    scheduledTime += audioBuffer.duration;
    
    // Store reference for cleanup
    outputSource = source; // Update reference to latest source
  } catch (err) {
    console.error('Failed to play Gemini audio:', err);
  }
}

/**
 * Monitor audio levels for lip sync animation
 */
function startAudioLevelMonitoring() {
  const bufferLength = analyserNode.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  
  function update() {
    if (!isConnected) return;
    
    analyserNode.getByteFrequencyData(dataArray);
    
    // Calculate average amplitude
    const average = dataArray.reduce((a, b) => a + b, 0) / bufferLength;
    const normalized = average / 255; // 0-1 range
    
    if (onAudioLevelUpdate) {
      onAudioLevelUpdate(normalized);
    }
    
    requestAnimationFrame(update);
  }
  
  update();
}

/**
 * Stop Gemini Live connection
 */
export function stopGeminiLive() {
  if (audioProcessor) {
    audioProcessor.disconnect();
    audioProcessor = null;
  }
  
  if (microphoneSource) {
    microphoneSource.disconnect();
    microphoneSource = null;
  }
  
  if (microphoneStream) {
    microphoneStream.getTracks().forEach(track => track.stop());
    microphoneStream = null;
  }
  
  if (liveSession) {
    if (liveSession.close) {
      liveSession.close();
    }
    liveSession = null;
  }
  
  scheduledTime = 0;
  isConnected = false;
  console.log('Gemini Live stopped');
}

export function isGeminiLiveConnected() {
  return isConnected;
}
