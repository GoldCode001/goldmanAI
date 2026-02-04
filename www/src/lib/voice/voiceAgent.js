/**
 * VoiceAgent - Orchestrates STT, LLM Streaming, and TTS
 * Now with tool execution support!
 */

import { initDeepgram, startListening as startSTT, stopListening as stopSTT, isDeepgramListening } from './deepgram.js';
import { initCartesia, startStreamingSession, sendTranscriptFragment, stopSpeaking } from './cartesia.js';
import { initAgent, sendMessage } from '../tools/agentClient.js';
import { setApprovalCallback, setAutonomyLevel } from '../tools/executor.js';

let isInitialized = false;
let onUserTranscriptCallback = null;
let onAIResponseCallback = null;
let onToolCallCallback = null;
let onToolResultCallback = null;
let useToolsMode = true; // Enable tools by default
let currentUserId = null;

const API_BASE = "https://aibackend-production-a44f.up.railway.app"; // Optimized primary backend

/**
 * Initialize the Voice Agent
 */
export async function initVoiceAgent(config) {
    const {
        deepgramApiKey,
        cartesiaApiKey,
        onUserTranscript,
        onAIResponse,
        onToolCall,
        onToolResult,
        onApproval,
        userId,
        autonomyLevel = 'ask', // 'ask', 'allowlist', 'full'
        enableTools = true
    } = config;

    // Initialize STT
    initDeepgram(deepgramApiKey, async (transcript, isFinal) => {
        if (onUserTranscript) onUserTranscript(transcript, isFinal);

        if (isFinal) {
            handleFinalTranscript(transcript);
        }
    });

    // Initialize TTS
    initCartesia(cartesiaApiKey);

    // Initialize tool system
    if (enableTools) {
        initAgent({
            autonomyLevel,
            onToolCallCb: (toolCall) => {
                console.log('[VoiceAgent] 🔧 Tool call:', toolCall.name);
                if (onToolCall) onToolCall(toolCall);
            },
            onToolResultCb: (name, result) => {
                console.log('[VoiceAgent] ✅ Tool result:', name, result.success);
                if (onToolResult) onToolResult(name, result);
            },
            onApprovalCb: onApproval || defaultApprovalHandler,
            onThinkingCb: (thinking, status) => {
                if (thinking) console.log('[VoiceAgent] 💭', status);
            }
        });
    }

    onUserTranscriptCallback = onUserTranscript;
    onAIResponseCallback = onAIResponse;
    onToolCallCallback = onToolCall;
    onToolResultCallback = onToolResult;
    useToolsMode = enableTools;
    currentUserId = userId;

    isInitialized = true;
    console.log('[VoiceAgent] Initialized with tools:', enableTools, 'autonomy:', autonomyLevel);
}

/**
 * Default approval handler - speaks the request
 */
async function defaultApprovalHandler(toolName, params) {
    // For voice, we could speak "Should I run this command?" and wait for yes/no
    // For now, just log and approve (dangerous tools still blocked by default)
    console.log('[VoiceAgent] 🔐 Approval requested for:', toolName, params);
    // TODO: Implement voice-based approval
    return true; // Auto-approve for now (dangerous tools still require explicit approval setup)
}

// Text buffer for smoother TTS (send sentences, not words)
let textBuffer = '';
let flushTimeout = null;
const VOICE_ID = 'e07c00bc-4134-4eae-9ea4-1a55fb45746b';
const MIN_CHARS_TO_SEND = 40; // Buffer at least 40 chars before sending
const FLUSH_DELAY_MS = 150; // Or flush after 150ms of no new content

/**
 * Flush buffered text to TTS
 */
function flushTextBuffer(isFinal = false) {
    if (flushTimeout) {
        clearTimeout(flushTimeout);
        flushTimeout = null;
    }

    if (textBuffer.length > 0 || isFinal) {
        console.log('[VoiceAgent] 📤 Flushing to TTS:', textBuffer.length, 'chars, final:', isFinal);
        sendTranscriptFragment(textBuffer, VOICE_ID, isFinal);
        textBuffer = '';
    }
}

/**
 * Add text to buffer and flush when ready
 */
function bufferText(text) {
    textBuffer += text;

    // Flush on sentence boundaries for natural speech
    const sentenceEnd = /[.!?]\s*$/;
    const hasSentenceEnd = sentenceEnd.test(textBuffer);

    // Flush if: sentence ends, buffer is large enough, or after timeout
    if (hasSentenceEnd || textBuffer.length >= MIN_CHARS_TO_SEND) {
        flushTextBuffer(false);
    } else {
        // Set timeout to flush if no more content arrives
        if (flushTimeout) clearTimeout(flushTimeout);
        flushTimeout = setTimeout(() => flushTextBuffer(false), FLUSH_DELAY_MS);
    }
}

/**
 * Handle final transcript from STT
 */
async function handleFinalTranscript(transcript) {
    console.log('[VoiceAgent] Handling final transcript:', transcript);

    // Reset buffer
    textBuffer = '';
    if (flushTimeout) {
        clearTimeout(flushTimeout);
        flushTimeout = null;
    }

    // Use tool-enabled agent or simple streaming
    if (useToolsMode) {
        await handleWithTools(transcript);
    } else {
        await handleStreaming(transcript);
    }
}

/**
 * Handle with tool-enabled agent (can execute commands)
 */
async function handleWithTools(transcript) {
    console.log('[VoiceAgent] 🔧 Using tool-enabled agent');

    try {
        const startTime = Date.now();

        // Send to agent and wait for response (handles tool loop internally)
        const response = await sendMessage(transcript, currentUserId);

        console.log('[VoiceAgent] ⚡ Agent response received. Latency:', Date.now() - startTime, 'ms');

        // Now speak the response - MUST await for socket to connect first!
        await startStreamingSession(VOICE_ID);

        // Notify callback with full response
        if (onAIResponseCallback) onAIResponseCallback(response);

        // Send to TTS in chunks for smooth speech
        const chunks = splitIntoSpeakableChunks(response);
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const isFinal = (i === chunks.length - 1);
            sendTranscriptFragment(chunk, VOICE_ID, isFinal);
            // Small delay between chunks for processing
            if (!isFinal) await new Promise(r => setTimeout(r, 50));
        }

        console.log('[VoiceAgent] ✅ Tool response spoken. Length:', response.length);

    } catch (error) {
        console.error('[VoiceAgent] Tool agent error:', error);
        // Speak error message
        await startStreamingSession(VOICE_ID);
        sendTranscriptFragment("Sorry, I encountered an error. " + error.message, VOICE_ID, true);
    }
}

/**
 * Split text into speakable chunks (sentences or ~100 chars)
 */
function splitIntoSpeakableChunks(text) {
    const chunks = [];
    // Split on sentence boundaries
    const sentences = text.match(/[^.!?]+[.!?]+\s*/g) || [text];

    for (const sentence of sentences) {
        if (sentence.length <= 100) {
            chunks.push(sentence);
        } else {
            // Split long sentences on commas or at ~100 char boundaries
            const parts = sentence.match(/.{1,100}(?:\s|$)/g) || [sentence];
            chunks.push(...parts);
        }
    }

    return chunks.filter(c => c.trim().length > 0);
}

/**
 * Handle with simple streaming (no tools, just conversation)
 */
async function handleStreaming(transcript) {
    console.log('[VoiceAgent] 📡 Using streaming mode');

    try {
        // Start TTS stream session
        startStreamingSession(VOICE_ID);

        // Request streaming response from LLM
        const response = await fetch(`${API_BASE}/api/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: transcript,
                userId: currentUserId,
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
                        console.log('[VoiceAgent] ⚡ FIRST CHUNK ARRIVED! Latency:', Date.now() - startTime, 'ms');
                        firstChunkArrived = true;
                    }

                    if (content) {
                        fullResponse += content;
                        if (onAIResponseCallback) onAIResponseCallback(content);

                        // Buffer text for smoother TTS (sends sentences, not words)
                        bufferText(content);
                    }
                }
            }
        }

        // Flush any remaining text and signal end
        flushTextBuffer(true);
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

/**
 * Enable or disable tool mode
 */
export function setToolsMode(enabled) {
    useToolsMode = enabled;
    console.log('[VoiceAgent] Tools mode:', enabled);
}

/**
 * Set current user ID (for personalization)
 */
export function setUserId(userId) {
    currentUserId = userId;
}

/**
 * Set autonomy level for tools
 * @param {'ask' | 'allowlist' | 'full'} level
 */
export function setVoiceAutonomy(level) {
    setAutonomyLevel(level);
    console.log('[VoiceAgent] Autonomy level:', level);
}
