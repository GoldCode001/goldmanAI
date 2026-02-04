/**
 * PAL Agent Client
 * Handles the agent loop with tool execution
 */

import { executeTool, setApprovalCallback, setAutonomyLevel } from './executor.js';

const API_BASE = "https://aibackend-production-a44f.up.railway.app";

// Callbacks
let onToolCall = null;      // Called when a tool is about to be executed
let onToolResult = null;    // Called with tool result
let onResponse = null;      // Called with final text response
let onThinking = null;      // Called while processing

// Conversation history for multi-turn
let conversationHistory = [];

/**
 * Initialize the agent client
 */
export function initAgent(config = {}) {
    const {
        onToolCallCb,
        onToolResultCb,
        onResponseCb,
        onThinkingCb,
        onApprovalCb,
        autonomyLevel = 'ask' // 'ask', 'allowlist', 'full'
    } = config;

    onToolCall = onToolCallCb;
    onToolResult = onToolResultCb;
    onResponse = onResponseCb;
    onThinking = onThinkingCb;

    // Set approval callback in executor
    if (onApprovalCb) {
        setApprovalCallback(onApprovalCb);
    }

    setAutonomyLevel(autonomyLevel);

    console.log('[AgentClient] Initialized with autonomy:', autonomyLevel);
}

/**
 * Clear conversation history
 */
export function clearHistory() {
    conversationHistory = [];
}

/**
 * Send a message to the agent and handle tool calls
 * @param {string} message - User message
 * @param {string} userId - Optional user ID for personalization
 * @returns {Promise<string>} - Final response text
 */
export async function sendMessage(message, userId = null) {
    console.log('[AgentClient] Sending:', message);

    if (onThinking) onThinking(true, 'Thinking...');

    try {
        // Add user message to history
        conversationHistory.push({ role: 'user', content: message });

        // Start the agent loop
        let response = await callAgent(message, userId);

        // Loop while we have tool calls
        let maxIterations = 10; // Safety limit
        let iterations = 0;

        while (response.type === 'tool_calls' && iterations < maxIterations) {
            iterations++;
            console.log('[AgentClient] Tool calls received:', response.tool_calls);

            // Add assistant message to history
            conversationHistory.push(response.assistantMessage);

            // Execute each tool
            const toolResults = [];
            for (const toolCall of response.tool_calls) {
                if (onThinking) onThinking(true, `Executing: ${toolCall.name}`);
                if (onToolCall) onToolCall(toolCall);

                console.log('[AgentClient] Executing tool:', toolCall.name, toolCall.arguments);
                const result = await executeTool(toolCall.name, toolCall.arguments);

                console.log('[AgentClient] Tool result:', result);
                if (onToolResult) onToolResult(toolCall.name, result);

                toolResults.push({
                    tool_call_id: toolCall.id,
                    output: result
                });
            }

            // Send tool results back to get next response
            if (onThinking) onThinking(true, 'Processing results...');
            response = await continueWithToolResults(toolResults, userId);
        }

        // Got final response
        if (onThinking) onThinking(false);

        if (response.type === 'response') {
            conversationHistory.push({
                role: 'assistant',
                content: response.content
            });

            if (onResponse) onResponse(response.content);
            return response.content;
        } else {
            // Exceeded max iterations
            const fallback = "I've completed several steps. Let me know if you need anything else!";
            if (onResponse) onResponse(fallback);
            return fallback;
        }

    } catch (error) {
        console.error('[AgentClient] Error:', error);
        if (onThinking) onThinking(false);
        throw error;
    }
}

/**
 * Call the agent API
 */
async function callAgent(prompt, userId) {
    const response = await fetch(`${API_BASE}/api/agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            prompt,
            userId,
            history: conversationHistory.slice(0, -1) // Exclude the message we just added
        })
    });

    if (!response.ok) {
        throw new Error(`Agent API failed: ${response.status}`);
    }

    return response.json();
}

/**
 * Continue agent with tool results
 */
async function continueWithToolResults(toolResults, userId) {
    const response = await fetch(`${API_BASE}/api/agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            toolResults,
            userId,
            history: conversationHistory
        })
    });

    if (!response.ok) {
        throw new Error(`Agent API failed: ${response.status}`);
    }

    return response.json();
}

/**
 * Send message via voice agent (streams response to TTS)
 * This bridges the tool-enabled agent with voice
 */
export async function sendVoiceMessage(transcript, userId, callbacks = {}) {
    const { onTextChunk, onComplete, onError } = callbacks;

    try {
        // Use the agent for tool-enabled responses
        const response = await sendMessage(transcript, userId);

        // Stream the response character by character for TTS
        if (onTextChunk) {
            // Split into chunks for TTS
            const chunks = response.match(/.{1,50}/g) || [response];
            for (const chunk of chunks) {
                onTextChunk(chunk);
                await new Promise(r => setTimeout(r, 50)); // Small delay between chunks
            }
        }

        if (onComplete) onComplete(response);
        return response;

    } catch (error) {
        console.error('[AgentClient] Voice message error:', error);
        if (onError) onError(error);
        throw error;
    }
}

/**
 * Get conversation history
 */
export function getHistory() {
    return [...conversationHistory];
}

/**
 * Set conversation history (for resuming sessions)
 */
export function setHistory(history) {
    conversationHistory = [...history];
}
