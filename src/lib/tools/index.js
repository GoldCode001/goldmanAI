/**
 * PAL Tools Module
 * Export all tool-related functionality
 */

export { TOOLS, getToolsForLLM, requiresApproval, getTool } from './registry.js';
export {
    executeTool,
    executeToolChain,
    setApprovalCallback,
    setAutonomyLevel,
    approveCommand
} from './executor.js';
export {
    initAgent,
    sendMessage,
    sendVoiceMessage,
    clearHistory,
    getHistory,
    setHistory
} from './agentClient.js';
