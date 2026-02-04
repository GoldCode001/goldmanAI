/**
 * Deepgram Speech-to-Text Integration
 * Using MediaRecorder (official Deepgram approach)
 */

let deepgramSocket = null;
let deepgramApiKey = null;
let isListening = false;
let mediaRecorder = null;
let onTranscriptCallback = null;

/**
 * Initialize Deepgram STT
 */
export function initDeepgram(apiKey, onTranscript) {
    deepgramApiKey = apiKey;
    onTranscriptCallback = onTranscript;
    console.log('[Deepgram] Initialized');
}

/**
 * Start listening for speech
 */
export async function startListening() {
    if (isListening) {
        console.warn('[Deepgram] Already listening');
        return;
    }

    if (!deepgramApiKey) {
        throw new Error('Deepgram API key not set');
    }

    try {
        // Get microphone access
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true
        });

        // Create MediaRecorder (official Deepgram approach)
        mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'audio/webm'
        });

        // Connect to Deepgram WebSocket
        // Using nova-3 model for high accuracy and low latency
        // endpointing=800 means wait 800ms of silence before finalizing (prevents cutting off user mid-sentence)
        const wsUrl = `wss://api.deepgram.com/v1/listen?model=nova-3&language=en&punctuate=true&interim_results=true&smart_format=true&endpointing=800`;

        console.log('[Deepgram] Connecting...');
        deepgramSocket = new WebSocket(wsUrl, ['token', deepgramApiKey]);

        deepgramSocket.onopen = () => {
            console.log('[Deepgram] WebSocket connected');
            isListening = true;

            // Only start recording if not already recording
            if (mediaRecorder && mediaRecorder.state === 'inactive') {
                mediaRecorder.start(250); // Send data every 250ms for lower latency
                console.log('[Deepgram] MediaRecorder started');
            } else if (mediaRecorder && mediaRecorder.state === 'recording') {
                console.log('[Deepgram] MediaRecorder already recording, skipping start');
            }

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0 && deepgramSocket?.readyState === WebSocket.OPEN) {
                    deepgramSocket.send(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                console.log('[Deepgram] MediaRecorder stopped');
            };
        };

        deepgramSocket.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.type === 'Results') {
                const transcript = data.channel?.alternatives?.[0]?.transcript;
                const isFinal = data.is_final;

                if (transcript && transcript.trim() && onTranscriptCallback) {
                    console.log('[Deepgram] Transcript:', transcript, 'isFinal:', isFinal);
                    onTranscriptCallback(transcript, isFinal);
                }
            }
        };

        deepgramSocket.onerror = (error) => {
            console.error('[Deepgram] WebSocket error:', error);
        };

        deepgramSocket.onclose = (event) => {
            console.log('[Deepgram] WebSocket closed');
            console.log('[Deepgram] Close code:', event.code);
            console.log('[Deepgram] Close reason:', event.reason);
            isListening = false;

            // Stop media recorder
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
            }
        };

    } catch (error) {
        console.error('[Deepgram] Failed to start listening:', error);
        throw error;
    }
}

/**
 * Stop listening
 */
export function stopListening() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }

    if (deepgramSocket) {
        deepgramSocket.close();
        deepgramSocket = null;
    }

    isListening = false;
    console.log('[Deepgram] Stopped listening');
}

/**
 * Check if currently listening
 */
export function isDeepgramListening() {
    return isListening;
}
