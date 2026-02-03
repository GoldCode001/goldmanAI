/**
 * Cartesia Text-to-Speech Integration
 * Ultra-low latency TTS with Contextual Streaming
 */

let cartesiaSocket = null;
let cartesiaApiKey = null;
let audioContext = null;
let audioQueue = [];
export let isSpeaking = false;
let nextStartTime = 0;
let analyser = null;
let scheduledSources = [];
let currentContextId = null; // Persistent context ID for the session

/**
 * Initialize Cartesia TTS
 */
export function initCartesia(apiKey) {
    cartesiaApiKey = apiKey;
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
        analyser = audioContext.createAnalyser();
        analyser.connect(audioContext.destination);
        console.log('[Cartesia] Initialized');
    } catch (error) {
        console.error('[Cartesia] Failed to initialize AudioContext:', error);
    }
}

/**
 * Base64 decode to Float32Array
 */
function decodeBase64ToFloat32(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return new Float32Array(bytes.buffer);
}

/**
 * Check if currently speaking
 */
export function isCartesiaSpeaking() {
    return isSpeaking;
}

/**
 * Stop current speech
 */
export function stopSpeaking() {
    // Stop all scheduled sources
    for (const source of scheduledSources) {
        try {
            source.stop();
        } catch (e) { }
    }
    scheduledSources = [];
    audioQueue = [];
    isSpeaking = false;
    nextStartTime = 0;
}

/**
 * Start a new streaming contextual session
 */
export async function startStreamingSession(voiceId = 'f786b574-daa5-4673-aa0c-cbe3e8534c02') {
    // If a socket is already open and ready, we can potentially reuse it or just close and reopen
    // For now, let's close and reopen to ensure a fresh session context
    if (cartesiaSocket && cartesiaSocket.readyState === WebSocket.OPEN) {
        return cartesiaSocket;
    }

    // Generate a new context ID for this session
    currentContextId = 'stream-' + Date.now();
    console.log('[Cartesia] Starting new session with context:', currentContextId);

    if (audioContext.state === 'suspended') {
        await audioContext.resume();
    }

    return new Promise((resolve, reject) => {
        const socket = new WebSocket(
            `wss://api.cartesia.ai/tts/websocket?api_key=${cartesiaApiKey}&cartesia_version=2024-06-10`
        );

        cartesiaSocket = socket;

        socket.onopen = () => {
            console.log('[Cartesia] Streaming socket connected');
            resolve(socket);
        };

        socket.onmessage = (event) => {
            if (socket !== cartesiaSocket) return;

            console.log('[Cartesia] 📩 Raw message received, type:', typeof event.data, 'isArrayBuffer:', event.data instanceof ArrayBuffer);

            if (event.data instanceof ArrayBuffer) {
                const audioData = new Float32Array(event.data);
                console.log('[Cartesia] ✅ Received RAW audio chunk:', audioData.length, 'samples');
                if (audioData.length > 0) {
                    audioQueue.push(audioData);
                    schedulePlayback();
                }
            } else {
                try {
                    const data = JSON.parse(event.data);
                    console.log('[Cartesia] 📨 Received JSON message:', JSON.stringify(data));

                    if (data.type === 'chunk' && data.data) {
                        const audioData = decodeBase64ToFloat32(data.data);
                        console.log('[Cartesia] ✅ Decoded base64 audio:', audioData.length, 'samples');
                        if (audioData.length > 0) {
                            audioQueue.push(audioData);
                            schedulePlayback();
                        }
                    } else if (data.done) {
                        console.log('[Cartesia] ✅ Generation done signal received');
                    } else if (data.error) {
                        console.error('[Cartesia] ❌ API Error:', data.error);
                    } else {
                        console.warn('[Cartesia] ⚠️ Unknown message type:', data);
                    }
                } catch (e) {
                    console.error('[Cartesia] ❌ Failed to parse message:', e);
                    console.log('[Cartesia] Raw data:', event.data);
                }
            }
        };

        socket.onerror = (err) => {
            console.error('[Cartesia] WebSocket error:', err);
            reject(err);
        };
        socket.onclose = (event) => {
            console.log('[Cartesia] WebSocket closed:', event.code, event.reason);
            if (cartesiaSocket === socket) cartesiaSocket = null;
        };
    });
}

/**
 * Send a partial transcript fragment to the current session
 */
export function sendTranscriptFragment(text, voiceId, isFinal = false) {
    if (!cartesiaSocket || cartesiaSocket.readyState !== WebSocket.OPEN) {
        // If socket isn't open, we might need to buffer or discard. 
        // In this architecture, voiceAgent should ensure it's open.
        return;
    }

    const request = {
        model_id: 'sonic-english',
        voice: { mode: 'id', id: voiceId || '69267136-1bdc-412f-ad78-0caad210fb40' },
        transcript: text,
        output_format: {
            container: 'raw',
            encoding: 'pcm_f32le',
            sample_rate: 24000
        },
        context_id: currentContextId,
        continue: !isFinal
    };

    console.log('[Cartesia] Sending fragment:', text.substring(0, 30), 'isFinal:', isFinal);
    cartesiaSocket.send(JSON.stringify(request));

    if (isFinal) {
        // After sending final, we can wait a bit and close or let onmessage 'done' handle it
    }
}

/**
 * Manually signal end of stream
 */
export function endStreamingSession() {
    if (cartesiaSocket && cartesiaSocket.readyState === WebSocket.OPEN) {
        // Optionally close the socket or leave it open for reuse
        // cartesiaSocket.close();
    }
}

/**
 * Schedule playback of queued audio chunks
 */
function schedulePlayback() {
    // We only wait for 1 chunk (approx 100ms) to ensure we have something to play
    // This reduces latency while still maintaining smooth playback
    if (!isSpeaking && audioQueue.length >= 1) {
        isSpeaking = true;
        // Ultra-low lead-in: 50ms (previously 80ms)
        nextStartTime = audioContext.currentTime + 0.05;
    }

    while (audioQueue.length > 0) {
        const chunk = audioQueue.shift();
        const buffer = audioContext.createBuffer(1, chunk.length, 24000);
        buffer.getChannelData(0).set(chunk);

        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(analyser);

        source.onended = () => {
            scheduledSources = scheduledSources.filter(s => s !== source);
            if (scheduledSources.length === 0 && audioQueue.length === 0) {
                isSpeaking = false;
            }
        };

        source.start(nextStartTime);
        scheduledSources.push(source);

        nextStartTime += buffer.duration;
    }
}
