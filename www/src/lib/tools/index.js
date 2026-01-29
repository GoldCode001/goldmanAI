/**
 * Tools Engine
 * Main entry point for AI tools/function calling
 *
 * This module:
 * - Registers all available tools
 * - Handles permission checking
 * - Executes tools when called by the AI
 * - Returns results back to the AI
 */

import { getToolByName, getGeminiTools, TOOL_DEFINITIONS } from './definitions.js';
import { checkPermission, requestPermission, PermissionState } from './permissions.js';
import { detectCapabilities, hasCapability } from './capabilities.js';
import * as executor from './executor.js';

// Map tool names to executor functions
const EXECUTORS = {
  remember_fact: executor.executeRememberFact,
  recall_facts: executor.executeRecallFacts,
  create_goal: executor.executeCreateGoal,
  update_goal: executor.executeUpdateGoal,
  get_goals: executor.executeGetGoals,
  create_habit: executor.executeCreateHabit,
  log_habit: executor.executeLogHabit,
  get_habits: executor.executeGetHabits,
  set_reminder: executor.executeSetReminder,
  set_timer: executor.executeSetTimer,
  web_search: executor.executeWebSearch,
  get_weather: executor.executeGetWeather,
  get_datetime: executor.executeGetDateTime,
  calculate: executor.executeCalculate,
  get_location: executor.executeGetLocation,
  send_notification: executor.executeSendNotification,
  copy_to_clipboard: executor.executeCopyToClipboard,
  // Calendar
  create_calendar_event: executor.executeCreateCalendarEvent,
  get_calendar_events: executor.executeGetCalendarEvents,
  // Contacts
  search_contacts: executor.executeSearchContacts,
  get_contact: executor.executeGetContact,
  // Files/Notes
  save_note: executor.executeSaveNote,
  read_note: executor.executeReadNote,
  list_notes: executor.executeListNotes,
};

/**
 * Initialize the tools engine
 * Should be called at app startup
 */
export async function initToolsEngine() {
  // Detect platform capabilities
  const capabilities = await detectCapabilities();
  console.log('Tools Engine initialized. Platform:', capabilities.platform);
  console.log('Available capabilities:', capabilities);

  return capabilities;
}

/**
 * Get tools formatted for Gemini Live config
 * Filters based on platform capabilities
 */
export async function getToolsForGemini() {
  const capabilities = await detectCapabilities();
  const allTools = getGeminiTools();

  // Filter tools based on capabilities
  const availableTools = allTools.filter(tool => {
    const def = TOOL_DEFINITIONS[tool.name];
    if (!def) return false;

    // Check if tool is available on this platform
    switch (tool.name) {
      case 'get_location':
        return capabilities.geolocation || capabilities.nativeGeolocation;
      case 'send_notification':
        return capabilities.notifications || capabilities.nativeNotifications;
      case 'copy_to_clipboard':
        return capabilities.clipboard;
      default:
        return true; // Most tools work everywhere
    }
  });

  return availableTools;
}

/**
 * Execute a tool call from the AI
 * Handles permission checking and execution
 *
 * @param {string} toolName - Name of the tool to execute
 * @param {object} args - Arguments from the AI
 * @returns {object} - Result to send back to AI
 */
export async function executeTool(toolName, args = {}) {
  console.log(`Executing tool: ${toolName}`, args);

  // Get tool definition
  const toolDef = getToolByName(toolName);
  if (!toolDef) {
    return {
      success: false,
      error: `Unknown tool: ${toolName}`
    };
  }

  // Check permission
  const permission = toolDef.permission;
  const permissionState = await checkPermission(permission);

  if (permissionState === PermissionState.DENIED) {
    return {
      success: false,
      error: `Permission denied for ${toolName}. The user has not allowed this action.`,
      permissionDenied: true
    };
  }

  if (permissionState === PermissionState.PROMPT) {
    // Request permission from user
    const reason = getPermissionReason(toolName, args);
    const granted = await requestPermission(permission, reason);

    if (!granted) {
      return {
        success: false,
        error: `User denied permission for ${toolName}.`,
        permissionDenied: true
      };
    }
  }

  // Execute the tool
  const executorFn = EXECUTORS[toolName];
  if (!executorFn) {
    return {
      success: false,
      error: `No executor found for tool: ${toolName}`
    };
  }

  try {
    const result = await executorFn(args);
    console.log(`Tool ${toolName} result:`, result);
    return result;
  } catch (err) {
    console.error(`Tool ${toolName} error:`, err);
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * Handle a function call response from Gemini
 * This is called when Gemini Live returns a function call in its response
 *
 * @param {object} functionCall - The function call from Gemini
 * @returns {object} - Function response to send back
 */
export async function handleGeminiFunctionCall(functionCall) {
  const { name, args } = functionCall;

  // Parse args if it's a string
  let parsedArgs = args;
  if (typeof args === 'string') {
    try {
      parsedArgs = JSON.parse(args);
    } catch (e) {
      parsedArgs = {};
    }
  }

  const result = await executeTool(name, parsedArgs);

  return {
    name,
    response: result
  };
}

/**
 * Process multiple function calls (if Gemini returns several)
 */
export async function handleGeminiFunctionCalls(functionCalls) {
  const results = await Promise.all(
    functionCalls.map(fc => handleGeminiFunctionCall(fc))
  );
  return results;
}

/**
 * Generate a human-readable permission reason
 */
function getPermissionReason(toolName, args) {
  switch (toolName) {
    case 'set_reminder':
      return `I'd like to set a reminder for you: "${args.message}"`;
    case 'set_timer':
      return `I'd like to set a ${args.duration} timer${args.label ? ` for ${args.label}` : ''}`;
    case 'get_location':
      return 'I need your location to help with this request';
    case 'send_notification':
      return `I'd like to send you a notification: "${args.title}"`;
    case 'web_search':
      return `I'd like to search the web for: "${args.query}"`;
    case 'get_weather':
      return `I'd like to check the weather${args.location !== 'current' ? ` for ${args.location}` : ''}`;
    case 'copy_to_clipboard':
      return 'I\'d like to copy some text to your clipboard';
    default:
      return `I need permission to use ${toolName.replace(/_/g, ' ')}`;
  }
}

/**
 * Get a summary of available tools for the AI system prompt
 */
export function getToolsSummary() {
  const tools = Object.values(TOOL_DEFINITIONS);
  const categories = {
    memory: [],
    goals: [],
    habits: [],
    reminders: [],
    information: [],
    device: []
  };

  tools.forEach(tool => {
    if (tool.name.includes('fact') || tool.name.includes('remember')) {
      categories.memory.push(tool.name);
    } else if (tool.name.includes('goal')) {
      categories.goals.push(tool.name);
    } else if (tool.name.includes('habit')) {
      categories.habits.push(tool.name);
    } else if (tool.name.includes('reminder') || tool.name.includes('timer')) {
      categories.reminders.push(tool.name);
    } else if (['web_search', 'get_weather', 'get_datetime', 'calculate'].includes(tool.name)) {
      categories.information.push(tool.name);
    } else {
      categories.device.push(tool.name);
    }
  });

  return categories;
}

// Re-export useful functions
export { detectCapabilities, hasCapability } from './capabilities.js';
export { checkPermission, getAllPermissions, grantPermission, revokePermission } from './permissions.js';
export { getGeminiTools, TOOL_DEFINITIONS } from './definitions.js';
