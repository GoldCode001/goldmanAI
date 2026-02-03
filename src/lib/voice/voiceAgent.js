/**
 * VoiceAgent - Orchestrates STT, LLM Streaming, and TTS
 */

import { initDeepgram, startListening as startSTT, stopListening as stopSTT, isDeepgramListening } from './deepgram.js';
import { initCartesia, startStreamingSession, sendTranscriptFragment, stopSpeaking } from './cartesia.js';

let isInitialized = false;
let onUserTranscriptCallback = null;
let onAIResponseCallback = null;

const API_BASE = "https://aibackend-production-a44f.up.railway.app"; // Optimized primary backend

/**
 * Initialize the Voice Agent
 */
export async function initVoiceAgent(config) {
    const { deepgramApiKey, cartesiaApiKey, onUserTranscript, onAIResponse } = config;

    initDeepgram(deepgramApiKey, async (transcript, isFinal) => {
        if (onUserTranscript) onUserTranscript(transcript, isFinal);

        if (isFinal) {
            handleFinalTranscript(transcript);
        }
    });

    initCartesia(cartesiaApiKey);

    onUserTranscriptCallback = onUserTranscript;
    onAIResponseCallback = onAIResponse;
    isInitialized = true;
    console.log('[VoiceAgent] Initialized');
}

/**
 * Handle final transcript from STT
 */
async function handleFinalTranscript(transcript) {
    console.log('[VoiceAgent] Handling final transcript:', transcript);

    try {
        // Start TTS stream session
        startStreamingSession('69267136-1bdc-412f-ad78-0caad210fb40');

        // Request streaming response from LLM
        const response = await fetch(`${API_BASE}/api/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: transcript,
                stream: true
            })
        });

        if (!response.ok) throw new Error('LLM request failed');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';
        let startTime = Date.now();
        let firstChunkArrived = false;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });

            const lines = chunk.split('\n');
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const content = line.replace('data: ', '').trim();
                    if (content === '[DONE]') break;

                    if (!firstChunkArrived) {
                        console.log('[VoiceAgent] ⚡ FIRST CHUNK ARRIVED! Pipeline is open. Latency:', Date.now() - startTime, 'ms');
                        firstChunkArrived = true;
                    }

                    if (content) {
                        fullResponse += content;
                        if (onAIResponseCallback) onAIResponseCallback(content);

                        // Send new content to Cartesia (fixed logic: send only delta)
                        sendTranscriptFragment(content, '69267136-1bdc-412f-ad78-0caad210fb40', false);
                    }
                }
            }
        }

        // Signal end of stream to Cartesia
        sendTranscriptFragment("", '69267136-1bdc-412f-ad78-0caad210fb40', true);
        console.log('[VoiceAgent] ✅ Stream finished. Total length:', fullResponse.length);

    } catch (error) {
        console.error('[VoiceAgent] Error in voice loop:', error);
    }
}

/**
 * Start the voice agent
 */
export async function startVoiceAgent() {
    if (!isInitialized) throw new Error('Voice agent not initialized');
    if (isDeepgramListening()) {
        console.log('[VoiceAgent] Already listening, skipping start');
        return;
    }
    await startSTT();
    console.log('[VoiceAgent] Started');
}

/**
 * Stop the voice agent
 */
export function stopVoiceAgent() {
    stopSTT();
    stopSpeaking();
    console.log('[VoiceAgent] Stopped');
}

/**
 * Check if the voice agent is active
 */
export function isVoiceAgentActive() {
    return isDeepgramListening();
}
