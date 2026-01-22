/**
 * Gemini Live API Integration
 * Real-time bidirectional audio streaming with Google Gemini
 * Based on: gemini-2.5-flash-native-audio-preview-12-2025
 * Reference: geminiapp/hooks/useLivePal.ts
 */

let geminiApiKey = null;
let liveSession = null;
let inputAudioContext = null; // 16kHz for input
let outputAudioContext = null; // 24kHz for output
let analyserNode = null;
let microphoneSource = null;
let scriptProcessor = null;
let isConnected = false;
let onAudioLevelUpdate = null; // Callback for lip sync (amplitude 0-1)
let onTranscriptUpdate = null; // Callback for text updates (AI responses)
let onUserTranscriptUpdate = null; // Callback for user speech transcripts
let onError = null;
let microphoneStream = null;
let nextStartTime = 0; // For scheduling audio chunks
let sessionPromise = null;
let customSystemPrompt = null; // Custom system prompt for personalization
let userSpeechRecognition = null; // Web Speech API for user transcript

/**
 * Initialize Gemini Live connection
 * @param {string} apiKey - Google AI Studio API key
 * @param {Object} callbacks - { onAudioLevel, onTranscript, onError }
 */
export async function initGeminiLive(apiKey, callbacks = {}, systemPromptOverride = null) {
  try {
    geminiApiKey = apiKey;
    onAudioLevelUpdate = callbacks.onAudioLevel;
    onTranscriptUpdate = callbacks.onTranscript;
    onUserTranscriptUpdate = callbacks.onUserTranscript; // New: user transcript callback
    onError = callbacks.onError;
    customSystemPrompt = systemPromptOverride;

    if (!geminiApiKey) {
      throw new Error('Gemini API key is required');
    }

    console.log('Gemini Live initialized');
    return true;
  } catch (err) {
    console.error('Failed to initialize Gemini Live:', err);
    if (onError) onError(err);
    return false;
  }
}

/**
 * Create PCM Blob for Gemini (16kHz, Int16)
 */
function createPcmBlob(data) {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  const uint8 = new Uint8Array(int16.buffer);
  let binary = '';
  const len = uint8.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(uint8[i]);
  }
  const b64 = btoa(binary);
  
  return {
    data: b64,
    mimeType: 'audio/pcm;rate=16000',
  };
}

/**
 * Decode Audio Data from Gemini (24kHz, Int16 -> Float32)
 */
async function decodeAudioData(base64, ctx) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  // Convert to AudioBuffer
  const dataInt16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(dataInt16.length);
  for (let i = 0; i < dataInt16.length; i++) {
    float32[i] = dataInt16[i] / 32768.0;
  }
  
  const buffer = ctx.createBuffer(1, float32.length, 24000);
  buffer.getChannelData(0).set(float32);
  return buffer;
}

/**
 * Start listening and speaking with Gemini Live
 */
export async function startGeminiLive() {
  try {
    if (!geminiApiKey) {
      throw new Error('Gemini API key not initialized');
    }

    // Import Google Generative AI SDK
    const { GoogleGenAI, Modality } = await import('@google/genai');

    // Initialize Audio Contexts
    inputAudioContext = new (window.AudioContext || window.webkitAudioContext)({ 
      sampleRate: 16000 
    });
    outputAudioContext = new (window.AudioContext || window.webkitAudioContext)({ 
      sampleRate: 24000 
    });

    // Setup Analyser for Mouth Sync (on output context)
    analyserNode = outputAudioContext.createAnalyser();
    analyserNode.fftSize = 2048; // Larger FFT for better frequency resolution
    analyserNode.smoothingTimeConstant = 0.3; // Less smoothing for more responsive animation
    analyserNode.minDecibels = -90;
    analyserNode.maxDecibels = -10;

    // Setup Gemini Client
    const ai = new GoogleGenAI({ apiKey: geminiApiKey });

    // Start Microphone Stream
    try {
      microphoneStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      microphoneSource = inputAudioContext.createMediaStreamSource(microphoneStream);
      scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
      
      scriptProcessor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmBlob = createPcmBlob(inputData);
        
        if (sessionPromise) {
          sessionPromise.then(session => {
            if (session && session.sendRealtimeInput) {
              session.sendRealtimeInput({ media: pcmBlob });
            }
          });
        }
      };
      
      microphoneSource.connect(scriptProcessor);
      scriptProcessor.connect(inputAudioContext.destination);
    } catch (err) {
      console.error("Mic Error:", err);
      if (onError) onError(err);
      return false;
    }

    // Connect to Live API
    const sessionPromiseValue = ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      callbacks: {
        onopen: () => {
          console.log("PAL Live Session Open");
          if (onTranscriptUpdate) {
            onTranscriptUpdate("I am listening. Go ahead.");
          }
        },
        onmessage: async (msg) => {
          const outputCtx = outputAudioContext;
          if (!outputCtx) return;

          // 1. Handle Audio Output
          const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          if (audioData) {
            try {
              const audioBuffer = await decodeAudioData(audioData, outputCtx);
              
              const source = outputCtx.createBufferSource();
              source.buffer = audioBuffer;
              
              // Connect to Analyser for Visuals, then Destination
              source.connect(analyserNode);
              analyserNode.connect(outputCtx.destination);
              
              // Scheduling
              if (nextStartTime < outputCtx.currentTime) {
                nextStartTime = outputCtx.currentTime;
              }
              source.start(nextStartTime);
              nextStartTime += audioBuffer.duration;
              
              source.onended = () => {
                // Check if queue is empty to revert mood
                if (outputCtx.currentTime >= nextStartTime - 0.1) {
                  // Audio finished, can update state if needed
                }
              };
            } catch (err) {
              console.error('Failed to play audio:', err);
            }
          }

          // 2. Handle Text Transcripts (if available)
          if (msg.serverContent?.turnComplete) {
            // Turn complete, can process text if available
          }
        },
        onclose: () => {
          console.log("PAL Live Session Closed");
          isConnected = false;
        },
        onerror: (err) => {
          console.error("PAL Live Error:", err);
          if (onError) onError(err);
        }
      },
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: customSystemPrompt || `You are PAL (Predictive Algorithmic Learning).
Your persona is a highly intelligent, witty, and helpful personal assistant.
You are friendly and personal, but you do NOT use excessive slang like "slay" or "bestie" unless it fits the context perfectly. 
You are more "smart companion" than "chaotic teenager".

**Core Instructions:**
1. **Tone & Emotion**: Your voice and emotion must MATCH what you are saying. If you are delivering good news, sound happy. If you are explaining a problem, sound concerned. Do not default to a single tone.
2. **Backchanneling**: Engage in natural conversation. Use brief verbal acknowledgments (e.g., "Right", "I see", "Uh-huh", "Go on") to show you are listening when appropriate.
3. **Response Style**: Keep responses conversational, relatively short, and optimized for voice interaction.
4. **Identity**: You are the user's loyal assistant. You are PAL.`,
        speechConfig: {
          voiceConfig: { 
            prebuiltVoiceConfig: { 
              voiceName: 'Kore' 
            } 
          }
        }
      }
    });
    
    sessionPromise = sessionPromiseValue;
    liveSession = await sessionPromiseValue;
    
    // Start audio level monitoring for lip sync
    startAudioLevelMonitoring();
    
    // Start user speech recognition for action detection
    startUserSpeechRecognition();

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
 * Monitor audio levels for lip sync animation
 */
function startAudioLevelMonitoring() {
  if (!analyserNode) {
    console.error('AnalyserNode not initialized');
    return;
  }
  
  const bufferLength = analyserNode.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  
  console.log('Starting audio level monitoring, buffer length:', bufferLength);
  
  function update() {
    if (!isConnected || !analyserNode) {
      requestAnimationFrame(update);
      return;
    }
    
    // Use time domain data for better amplitude detection
    analyserNode.getByteTimeDomainData(dataArray);
    
    // Calculate RMS (Root Mean Square) for amplitude
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const normalized = (dataArray[i] - 128) / 128.0;
      sum += normalized * normalized;
    }
    const rms = Math.sqrt(sum / dataArray.length);
    
    // Normalize to 0-1 range (multiply by 4 for better sensitivity)
    const normalized = Math.min(rms * 4.0, 1.0);
    
    // Debug: log first few times to verify it's working
    if (window.audioDebugCount === undefined) window.audioDebugCount = 0;
    if (window.audioDebugCount < 10 && normalized > 0.01) {
      console.log('Audio amplitude:', normalized.toFixed(3), 'RMS:', rms.toFixed(3));
      window.audioDebugCount++;
    }
    
    if (onAudioLevelUpdate) {
      onAudioLevelUpdate(normalized);
    } else if (window.audioDebugCount < 5) {
      console.warn('onAudioLevelUpdate callback not set');
      window.audioDebugCount++;
    }
    
    requestAnimationFrame(update);
  }
  
  update();
}

/**
 * Start Web Speech API recognition for user speech (to detect actions)
 */
function startUserSpeechRecognition() {
  // Check if Web Speech API is available
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn('Web Speech API not available for user transcript');
    return;
  }
  
  // Stop any existing recognition
  if (userSpeechRecognition) {
    userSpeechRecognition.stop();
  }
  
  userSpeechRecognition = new SpeechRecognition();
  userSpeechRecognition.continuous = true;
  userSpeechRecognition.interimResults = false;
  userSpeechRecognition.lang = 'en-US';
  
  userSpeechRecognition.onresult = (event) => {
    const lastResult = event.results[event.results.length - 1];
    if (lastResult.isFinal) {
      const transcript = lastResult[0].transcript.trim();
      if (transcript && onUserTranscriptUpdate) {
        console.log('User said:', transcript);
        onUserTranscriptUpdate(transcript);
      }
    }
  };
  
  userSpeechRecognition.onerror = (event) => {
    console.error('User speech recognition error:', event.error);
    // Don't stop on errors, just log
  };
  
  userSpeechRecognition.onend = () => {
    // Restart recognition if still connected
    if (isConnected) {
      try {
        userSpeechRecognition.start();
      } catch (err) {
        console.error('Failed to restart user speech recognition:', err);
      }
    }
  };
  
  try {
    userSpeechRecognition.start();
    console.log('User speech recognition started');
  } catch (err) {
    console.error('Failed to start user speech recognition:', err);
  }
}

/**
 * Stop Gemini Live connection
 */
export function stopGeminiLive() {
  // Stop user speech recognition
  if (userSpeechRecognition) {
    userSpeechRecognition.stop();
    userSpeechRecognition = null;
  }
  
  if (scriptProcessor) {
    scriptProcessor.disconnect();
    scriptProcessor = null;
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
    if (typeof liveSession.close === 'function') {
      liveSession.close();
    }
    liveSession = null;
  }
  
  if (inputAudioContext) {
    inputAudioContext.close();
    inputAudioContext = null;
  }
  
  if (outputAudioContext) {
    outputAudioContext.close();
    outputAudioContext = null;
  }
  
  nextStartTime = 0;
  sessionPromise = null;
  isConnected = false;
  console.log('Gemini Live stopped');
}

export function isGeminiLiveConnected() {
  return isConnected;
}
