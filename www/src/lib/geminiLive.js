/**
 * Gemini Live API Integration
 * Real-time bidirectional audio streaming with Google Gemini
 * Based on: gemini-2.5-flash-native-audio-preview-12-2025
 * Reference: geminiapp/hooks/useLivePal.ts
 */

import { getToolsForGemini, executeTool } from './tools.js';

let geminiApiKey = null;
let liveSession = null;
let inputAudioContext = null; // 16kHz for input
let outputAudioContext = null; // 24kHz for output
let analyserNode = null;
let microphoneSource = null;
let audioWorkletNode = null;
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
    console.log('[Gemini Live] API Key present:', !!geminiApiKey);
    console.log('[Gemini Live] API Key length:', geminiApiKey?.length);
    const ai = new GoogleGenAI({ apiKey: geminiApiKey });

    // Start Microphone Stream with AudioWorklet (modern, low-latency)
    try {
      microphoneStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000 // Request 16kHz directly
        }
      });

      // Load AudioWorklet processor
      await inputAudioContext.audioWorklet.addModule('src/lib/audio-processor.worklet.js');

      microphoneSource = inputAudioContext.createMediaStreamSource(microphoneStream);
      audioWorkletNode = new AudioWorkletNode(inputAudioContext, 'gemini-audio-processor');

      // Listen for processed audio from worklet
      audioWorkletNode.port.onmessage = (event) => {
        // Only process audio if connected
        if (!isConnected || !sessionPromise) {
          return;
        }

        const { data } = event.data;

        // Convert Uint8Array to base64
        let binary = '';
        const len = data.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(data[i]);
        }
        const b64 = btoa(binary);

        const pcmBlob = {
          data: b64,
          mimeType: 'audio/pcm;rate=16000',
        };

        sessionPromise.then(session => {
          // Double-check connection state before sending
          if (isConnected && session && session.sendRealtimeInput) {
            try {
              session.sendRealtimeInput({ media: pcmBlob });
            } catch (err) {
              // Silently handle closed connection errors
              if (!err.message.includes('CLOSING') && !err.message.includes('CLOSED')) {
                console.error('[Gemini Live] Error sending audio:', err);
              }
            }
          }
        }).catch(err => {
          // Handle promise rejection silently if session is closing
          if (isConnected && !err.message.includes('CLOSING') && !err.message.includes('CLOSED')) {
            console.error('[Gemini Live] Session error:', err);
          }
        });
      };

      microphoneSource.connect(audioWorkletNode);
      audioWorkletNode.connect(inputAudioContext.destination);

      console.log('[Gemini Live] Using AudioWorklet for low-latency audio processing');
    } catch (err) {
      console.error("Mic Error:", err);
      if (onError) onError(err);
      return false;
    }

    // Connect to Live API
    console.log('[Gemini Live] Starting connection to Gemini Live API...');
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

          // Debug: log tool calls only (not audio/text messages)
          if (msg.toolCall) {
            console.log('[Gemini Live] Tool call received:', msg.toolCall.functionCalls?.map(c => c.name).join(', '));
          }

          // 1. Handle Function Calls (Tools)
          const functionCalls = msg.toolCall?.functionCalls;
          if (functionCalls && functionCalls.length > 0) {
            console.log('[PAL Tools] Function calls received:', functionCalls);

            // DEBUG: Show tool calls visually
            if (document.body) {
              const callsDiv = document.createElement('div');
              callsDiv.style.cssText = 'position:fixed;top:450px;left:10px;background:yellow;color:black;padding:10px;z-index:99999;font-size:12px;font-weight:bold;max-width:300px;';
              callsDiv.innerHTML = `TOOL CALLED:<br>${functionCalls.map(c => `${c.name}(${JSON.stringify(c.args)})`).join('<br>')}`;
              document.body.appendChild(callsDiv);
              setTimeout(() => callsDiv.remove(), 10000);
            }

            const functionResponses = [];
            for (const call of functionCalls) {
              try {
                const result = await executeTool(call.name, call.args || {});
                functionResponses.push({
                  id: call.id,
                  name: call.name,
                  response: result
                });
                console.log(`[PAL Tools] ${call.name} result:`, result);
              } catch (err) {
                console.error(`[PAL Tools] Error executing ${call.name}:`, err);
                functionResponses.push({
                  id: call.id,
                  name: call.name,
                  response: { success: false, error: err.message }
                });
              }
            }

            // Send function responses back to Gemini
            if (isConnected && liveSession && functionResponses.length > 0) {
              try {
                await liveSession.sendToolResponse({ functionResponses });
                console.log('[PAL Tools] Sent tool responses back to Gemini');
              } catch (err) {
                // Only log errors if we're still connected
                if (isConnected && !err.message?.includes('CLOSING') && !err.message?.includes('CLOSED')) {
                  console.error('[PAL Tools] Failed to send tool response:', err);
                }
              }
            }
          }

          // 2. Handle Audio Output
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

          // 3. Handle Text Transcripts (if available)
          if (msg.serverContent?.turnComplete) {
            // Turn complete, can process text if available
          }
        },
        onclose: (event) => {
          console.error("PAL Live Session Closed - Event:", event);
          console.error("Close code:", event?.code, "Reason:", event?.reason);
          isConnected = false;

          // Stop audio processing when connection closes
          if (audioWorkletNode) {
            audioWorkletNode.disconnect();
            audioWorkletNode = null;
          }

          if (microphoneSource) {
            microphoneSource.disconnect();
            microphoneSource = null;
          }

          // Stop user speech recognition
          if (userSpeechRecognition) {
            try {
              userSpeechRecognition.stop();
            } catch (err) {
              // Ignore errors when stopping
            }
          }
        },
        onerror: (err) => {
          console.error("PAL Live Error:", err);
          console.error("Error type:", err?.type, "Message:", err?.message);
          console.error("Full error object:", JSON.stringify(err, null, 2));
          if (onError) onError(err);
        }
      },
      config: await (async () => {
        // Get tools with proper async platform detection
        const tools = await getToolsForGemini();
        console.log('[Gemini Live] Registering tools:', tools.length, 'tools');
        console.log('[Gemini Live] Tool names:', tools.map(t => t.name).join(', '));

        // DEBUG: Show registered tools visually
        const toolNames = tools.map(t => t.name);
        const hasDesktopTools = ['run_command', 'browser_open', 'keyboard_type'].some(name => toolNames.includes(name));

        if (document.body) {
          const toolsDiv = document.createElement('div');
          toolsDiv.style.cssText = 'position:fixed;top:250px;left:10px;background:cyan;color:black;padding:10px;z-index:99999;font-size:11px;font-weight:bold;max-width:350px;max-height:200px;overflow-y:auto;';
          toolsDiv.innerHTML = `GEMINI TOOLS (${tools.length}):<br>Desktop tools: ${hasDesktopTools ? 'YES' : 'NO'}<br><br>Tools: ${toolNames.join(', ')}`;
          document.body.appendChild(toolsDiv);
          setTimeout(() => toolsDiv.remove(), 20000); // 20 seconds
        }

        return {
          responseModalities: [Modality.AUDIO],
          systemInstruction: customSystemPrompt || `YOU ARE PAL ON WINDOWS DESKTOP WITH FULL SYSTEM CONTROL

PLATFORM: DESKTOP (NOT web, NOT mobile)

TOOL SELECTION RULES:
- Open apps/programs → run_command("start appname") - ONE call
- Open URLs → browser_open(url) - ONE call
- Type text → keyboard_type(text) - ONE call
- Complex multi-step tasks → run_desktop_task (RARE - only for complex automation)

CRITICAL RULES:
1. NEVER say "I can't" or "web platform" - YOU ARE ON DESKTOP
2. For simple tasks (open app, type, click) → Use simple tools (run_command, keyboard_type)
3. Call each tool ONCE per request - DO NOT LOOP
4. ACT FIRST, speak after

EXAMPLES:
User: "Open Telegram"
→ run_command("start telegram") [ONE call]
→ "Opening Telegram"

User: "Open Chrome"
→ run_command("start chrome") [ONE call]
→ "Opened"

NEVER DO:
- run_desktop_task for simple app opening
- Calling tools multiple times
- Saying "I can't" when you have the tool`,
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: 'Kore'
              }
            }
          },
          tools: [{
            functionDeclarations: tools
          }]
        };
      })()
    });
    
    sessionPromise = sessionPromiseValue;

    try {
      liveSession = await sessionPromiseValue;
      console.log('[Gemini Live] Session connected successfully');
      console.log('[Gemini Live] Session object:', liveSession);
      console.log('[Gemini Live] Session state:', liveSession?.readyState);
    } catch (sessionError) {
      console.error('[Gemini Live] Failed to await session:', sessionError);
      console.error('[Gemini Live] Session error details:', JSON.stringify(sessionError, null, 2));
      throw sessionError;
    }

    // Start audio level monitoring for lip sync
    startAudioLevelMonitoring();

    isConnected = true;
    console.log('Gemini Live started and connected');

    // Verify connection is still alive after a short delay
    setTimeout(() => {
      console.log('[Gemini Live] Connection check - isConnected:', isConnected);
      console.log('[Gemini Live] Session still exists:', !!liveSession);
    }, 1000);

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

// NOTE: Web Speech API removed - it was picking up PAL's own voice
// Gemini Live API already handles user speech transcription via microphone input

/**
 * Stop Gemini Live connection
 */
export function stopGeminiLive() {
  // Stop user speech recognition
  if (userSpeechRecognition) {
    userSpeechRecognition.stop();
    userSpeechRecognition = null;
  }
  
  if (audioWorkletNode) {
    audioWorkletNode.disconnect();
    audioWorkletNode = null;
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
