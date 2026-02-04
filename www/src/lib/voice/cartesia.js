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
        analyser.fftSize = 256;
        analyser.connect(audioContext.destination);
    } catch (e) {
        console.error('[Cartesia] Failed to init AudioContext:', e);
    }
}

/**
 * Stop any current audio and clear everything
 */
export function stopSpeaking() {
    isSpeaking = false;
    audioQueue = [];
    nextStartTime = 0;

    scheduledSources.forEach(source => {
        try { source.stop(); } catch (e) { }
    });
    scheduledSources = [];

    closeSocket();

    if (window.updateFaceMouth) window.updateFaceMouth(0);
}

function closeSocket() {
    if (cartesiaSocket) {
        try {
            if (cartesiaSocket.readyState === WebSocket.OPEN || cartesiaSocket.readyState === WebSocket.CONNECTING) {
                cartesiaSocket.close();
            }
        } catch (e) { }
        cartesiaSocket = null;
    }
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

    const wsUrl = `wss://api.cartesia.ai/tts/websocket?api_key=${cartesiaApiKey}&cartesia_version=2024-06-10`;

    return new Promise((resolve, reject) => {
        const socket = new WebSocket(wsUrl);
        cartesiaSocket = socket;
        socket.binaryType = 'arraybuffer';

        socket.onopen = () => {
            console.log('[Cartesia] Streaming socket connected');
            resolve(socket);
        };

        socket.onmessage = (event) => {
            if (socket !== cartesiaSocket) return;

            if (event.data instanceof ArrayBuffer) {
                const audioData = new Float32Array(event.data);
                if (audioData.length > 0) {
                    audioQueue.push(audioData);
                    schedulePlayback();
                }
            } else {
                try {
                    const data = JSON.parse(event.data);

                    if (data.type === 'chunk' && data.data) {
                        const audioData = decodeBase64ToFloat32(data.data);
                        if (audioData.length > 0) {
                            audioQueue.push(audioData);
                            schedulePlayback();
                        }
                    } else if (data.type === 'timestamps') {
                        // Ignore timestamp messages - they're just metadata
                    } else if (data.done || data.type === 'done') {
                        console.log('[Cartesia] ✅ Done');
                    } else if (data.error) {
                        console.error('[Cartesia] ❌ ERROR:', data.error);
                    }
                } catch (e) {
                    console.error('[Cartesia] ❌ Parse error:', e);
                    console.log('[Cartesia] Raw:', event.data.substring(0, 200));
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
        voice: { mode: 'id', id: voiceId || '69267136-1bdc-412f-ad78-0caad210fb40' }, // Friendly Reading Man
        transcript: text,
        output_format: {
            container: 'raw',
            encoding: 'pcm_f32le',
            sample_rate: 24000
        },
        context_id: currentContextId,
        continue: !isFinal,
        add_timestamps: true
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
    closeSocket();
}

/**
 * Backward compatibility function
 */
export async function speak(text, voiceId) {
    await startStreamingSession(voiceId);
    sendTranscriptFragment(text, voiceId, true);
}

function decodeBase64ToFloat32(base64) {
    const binary = atob(base64);
    const buffer = new ArrayBuffer(binary.length);
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const alignedLength = Math.floor(buffer.byteLength / 4) * 4;
    return new Float32Array(buffer, 0, alignedLength / 4);
}

function updateFaceFromAnalyser() {
    if (!isSpeaking || !analyser) return;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
        const val = (dataArray[i] - 128) / 128;
        sum += val * val;
    }
    const rms = Math.sqrt(sum / dataArray.length);
    if (window.updateFaceMouth) window.updateFaceMouth(rms * 6.0);
    if (isSpeaking) requestAnimationFrame(updateFaceFromAnalyser);
}

function schedulePlayback() {
    // Buffer more audio before starting for smoother playback
    // Wait for 5 chunks (~500ms of audio) to handle network variance
    const MIN_CHUNKS_TO_START = 5;
    const LEAD_IN_TIME = 0.15; // 150ms lead-in for smoother start
    const GAP_RECOVERY_TIME = 0.1; // 100ms gap recovery

    if (!isSpeaking && audioQueue.length >= MIN_CHUNKS_TO_START) {
        isSpeaking = true;
        nextStartTime = audioContext.currentTime + LEAD_IN_TIME;
        updateFaceFromAnalyser();
        console.log('[Cartesia] 🎵 Starting playback with', audioQueue.length, 'chunks buffered');
    }

    if (isSpeaking) {
        while (audioQueue.length > 0) {
            const audioData = audioQueue.shift();
            const audioBuffer = audioContext.createBuffer(1, audioData.length, 24000);
            audioBuffer.getChannelData(0).set(audioData);

            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(analyser);

            const currentTime = audioContext.currentTime;
            // If we're behind, push forward to avoid gaps/stuttering
            if (nextStartTime < currentTime) {
                nextStartTime = currentTime + GAP_RECOVERY_TIME;
            }

            source.start(nextStartTime);
            scheduledSources.push(source);
            nextStartTime += audioBuffer.duration;

            source.onended = () => {
                scheduledSources = scheduledSources.filter(s => s !== source);
                // If everything is done and socket is gone, we are officially silent
                if (scheduledSources.length === 0 && audioQueue.length === 0 && !cartesiaSocket) {
                    isSpeaking = false;
                    if (window.updateFaceMouth) window.updateFaceMouth(0);
                }
            };
        }
    }
}
