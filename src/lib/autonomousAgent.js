/**
 * PAL Autonomous Agent
 * Enables PAL to control the device autonomously like ClawdBot
 * Works on Android via Accessibility Service
 */

import { registerPlugin } from '@capacitor/core';

// Register the native plugin
const PalAgent = registerPlugin('PalAgent');

// Agent state
let isAgentRunning = false;
let currentTask = null;
let taskQueue = [];
let onStatusUpdate = null;

// ==================== PLUGIN INTERFACE ====================

/**
 * Check if accessibility service is enabled
 */
export async function isServiceEnabled() {
  try {
    const result = await PalAgent.isServiceEnabled();
    return result.enabled;
  } catch (e) {
    console.warn('[Agent] Plugin not available (web mode):', e);
    return false;
  }
}

/**
 * Open accessibility settings for user to enable service
 */
export async function openAccessibilitySettings() {
  try {
    await PalAgent.openAccessibilitySettings();
  } catch (e) {
    console.error('[Agent] Failed to open settings:', e);
  }
}

/**
 * Get current screen content as structured data
 */
export async function getScreenContent() {
  try {
    const result = await PalAgent.getScreenContent();
    return JSON.parse(result.content);
  } catch (e) {
    console.error('[Agent] Failed to get screen:', e);
    return null;
  }
}

/**
 * Find elements by text
 */
export async function findElements(text) {
  try {
    const result = await PalAgent.findElements({ text });
    return JSON.parse(result.elements);
  } catch (e) {
    console.error('[Agent] Failed to find elements:', e);
    return [];
  }
}

// ==================== ACTIONS ====================

export async function click(x, y) {
  try {
    const result = await PalAgent.click({ x, y });
    return result.success;
  } catch (e) {
    console.error('[Agent] Click failed:', e);
    return false;
  }
}

export async function clickText(text) {
  try {
    const result = await PalAgent.clickText({ text });
    return result.success;
  } catch (e) {
    console.error('[Agent] Click text failed:', e);
    return false;
  }
}

export async function longPress(x, y) {
  try {
    const result = await PalAgent.longPress({ x, y });
    return result.success;
  } catch (e) {
    console.error('[Agent] Long press failed:', e);
    return false;
  }
}

export async function swipe(startX, startY, endX, endY, duration = 300) {
  try {
    const result = await PalAgent.swipe({ startX, startY, endX, endY, duration });
    return result.success;
  } catch (e) {
    console.error('[Agent] Swipe failed:', e);
    return false;
  }
}

export async function typeText(text) {
  try {
    const result = await PalAgent.typeText({ text });
    return result.success;
  } catch (e) {
    console.error('[Agent] Type failed:', e);
    return false;
  }
}

export async function scroll(direction = 'down') {
  try {
    const result = await PalAgent.scroll({ direction });
    return result.success;
  } catch (e) {
    console.error('[Agent] Scroll failed:', e);
    return false;
  }
}

export async function pressBack() {
  try {
    const result = await PalAgent.pressBack();
    return result.success;
  } catch (e) {
    console.error('[Agent] Back failed:', e);
    return false;
  }
}

export async function pressHome() {
  try {
    const result = await PalAgent.pressHome();
    return result.success;
  } catch (e) {
    console.error('[Agent] Home failed:', e);
    return false;
  }
}

export async function openApp(packageName) {
  try {
    const result = await PalAgent.openApp({ packageName });
    return result.success;
  } catch (e) {
    console.error('[Agent] Open app failed:', e);
    return false;
  }
}

export async function openNotifications() {
  try {
    const result = await PalAgent.openNotifications();
    return result.success;
  } catch (e) {
    console.error('[Agent] Open notifications failed:', e);
    return false;
  }
}

export async function takeScreenshot() {
  try {
    const result = await PalAgent.takeScreenshot();
    return result.success;
  } catch (e) {
    console.error('[Agent] Screenshot failed:', e);
    return false;
  }
}

// ==================== COMMON APPS ====================

const COMMON_APPS = {
  'chrome': 'com.android.chrome',
  'youtube': 'com.google.android.youtube',
  'gmail': 'com.google.android.gm',
  'maps': 'com.google.android.apps.maps',
  'calendar': 'com.google.android.calendar',
  'messages': 'com.google.android.apps.messaging',
  'phone': 'com.google.android.dialer',
  'camera': 'com.android.camera',
  'settings': 'com.android.settings',
  'twitter': 'com.twitter.android',
  'x': 'com.twitter.android',
  'instagram': 'com.instagram.android',
  'whatsapp': 'com.whatsapp',
  'telegram': 'org.telegram.messenger',
  'spotify': 'com.spotify.music',
  'netflix': 'com.netflix.mediaclient',
};

export function getAppPackage(appName) {
  return COMMON_APPS[appName.toLowerCase()] || appName;
}

// ==================== AUTONOMOUS AGENT ====================

/**
 * Execute a single action based on AI decision
 */
export async function executeAction(action) {
  console.log('[Agent] Executing action:', action);

  switch (action.type) {
    case 'click':
      if (action.text) {
        return await clickText(action.text);
      } else if (action.x !== undefined && action.y !== undefined) {
        return await click(action.x, action.y);
      }
      break;

    case 'type':
      return await typeText(action.text);

    case 'swipe':
      return await swipe(action.startX, action.startY, action.endX, action.endY, action.duration);

    case 'scroll':
      return await scroll(action.direction);

    case 'back':
      return await pressBack();

    case 'home':
      return await pressHome();

    case 'openApp':
      const pkg = getAppPackage(action.app);
      return await openApp(pkg);

    case 'wait':
      await new Promise(resolve => setTimeout(resolve, action.duration || 1000));
      return true;

    case 'screenshot':
      return await takeScreenshot();

    default:
      console.warn('[Agent] Unknown action type:', action.type);
      return false;
  }

  return false;
}

/**
 * Parse AI response into executable actions
 */
export function parseActionsFromResponse(response) {
  const actions = [];

  // Look for action patterns in AI response
  const actionPatterns = [
    { regex: /open\s+(\w+)/i, type: 'openApp', extract: (m) => ({ app: m[1] }) },
    { regex: /click\s+(?:on\s+)?["']?([^"'\n]+)["']?/i, type: 'click', extract: (m) => ({ text: m[1].trim() }) },
    { regex: /type\s+["']([^"']+)["']/i, type: 'type', extract: (m) => ({ text: m[1] }) },
    { regex: /scroll\s+(up|down|left|right)/i, type: 'scroll', extract: (m) => ({ direction: m[1] }) },
    { regex: /go\s+back/i, type: 'back', extract: () => ({}) },
    { regex: /press\s+back/i, type: 'back', extract: () => ({}) },
    { regex: /go\s+home/i, type: 'home', extract: () => ({}) },
    { regex: /wait\s+(\d+)\s*(?:seconds?|s)?/i, type: 'wait', extract: (m) => ({ duration: parseInt(m[1]) * 1000 }) },
  ];

  for (const pattern of actionPatterns) {
    const match = response.match(pattern.regex);
    if (match) {
      actions.push({
        type: pattern.type,
        ...pattern.extract(match)
      });
    }
  }

  return actions;
}

/**
 * Run autonomous task loop
 * Takes a goal and works towards it step by step
 */
export async function runAutonomousTask(goal, options = {}) {
  const {
    maxSteps = 20,
    onStep = () => {},
    onComplete = () => {},
    onError = () => {},
    getAIDecision = null
  } = options;

  if (!getAIDecision) {
    throw new Error('getAIDecision callback required');
  }

  isAgentRunning = true;
  currentTask = goal;

  console.log('[Agent] Starting autonomous task:', goal);

  let stepCount = 0;
  let lastScreenContent = null;

  try {
    while (isAgentRunning && stepCount < maxSteps) {
      stepCount++;

      // 1. Get current screen state
      const screenContent = await getScreenContent();
      if (!screenContent) {
        await new Promise(resolve => setTimeout(resolve, 500));
        continue;
      }

      // 2. Format screen for AI
      const screenDescription = formatScreenForAI(screenContent);

      // 3. Ask AI what to do next
      const aiPrompt = `
You are PAL, an autonomous agent controlling an Android phone.

CURRENT GOAL: ${goal}

CURRENT SCREEN:
${screenDescription}

Based on the current screen, decide the NEXT SINGLE ACTION to take.
Respond with ONE action in this exact format:
- To open an app: "open [app name]"
- To click something: "click [text on button/element]"
- To type text: "type 'text to type'"
- To scroll: "scroll down" or "scroll up"
- To go back: "go back"
- To wait: "wait 2 seconds"

If the goal is complete, respond with: "GOAL COMPLETE: [brief explanation]"
If the goal is impossible, respond with: "GOAL FAILED: [reason]"

Your next action:`;

      const aiResponse = await getAIDecision(aiPrompt);
      console.log('[Agent] AI decision:', aiResponse);

      // 4. Check if goal is complete or failed
      if (aiResponse.includes('GOAL COMPLETE')) {
        onComplete({ success: true, message: aiResponse, steps: stepCount });
        break;
      }

      if (aiResponse.includes('GOAL FAILED')) {
        onError({ message: aiResponse, steps: stepCount });
        break;
      }

      // 5. Parse and execute action
      const actions = parseActionsFromResponse(aiResponse);
      if (actions.length > 0) {
        const action = actions[0]; // Execute one action at a time
        onStep({ step: stepCount, action, aiResponse });

        const success = await executeAction(action);
        if (!success) {
          console.warn('[Agent] Action failed, retrying...');
        }

        // Wait for UI to update
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        console.warn('[Agent] No action parsed from AI response');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (stepCount >= maxSteps) {
      onError({ message: 'Max steps reached', steps: stepCount });
    }
  } catch (error) {
    console.error('[Agent] Autonomous task error:', error);
    onError({ message: error.message, steps: stepCount });
  } finally {
    isAgentRunning = false;
    currentTask = null;
  }
}

/**
 * Stop the currently running autonomous task
 */
export function stopAutonomousTask() {
  isAgentRunning = false;
  console.log('[Agent] Task stopped');
}

/**
 * Format screen content for AI understanding
 */
function formatScreenForAI(screen) {
  if (!screen || !screen.elements) {
    return 'Unable to read screen';
  }

  const lines = [`App: ${screen.packageName || 'Unknown'}`];

  // Group elements by type
  const buttons = [];
  const textFields = [];
  const texts = [];

  for (const el of screen.elements) {
    if (el.clickable && (el.text || el.contentDescription)) {
      buttons.push(el.text || el.contentDescription);
    } else if (el.editable) {
      textFields.push(el.text || '[empty field]');
    } else if (el.text) {
      texts.push(el.text);
    }
  }

  if (buttons.length > 0) {
    lines.push(`\nClickable elements: ${buttons.slice(0, 15).join(', ')}`);
  }

  if (textFields.length > 0) {
    lines.push(`\nText fields: ${textFields.slice(0, 5).join(', ')}`);
  }

  if (texts.length > 0) {
    lines.push(`\nVisible text: ${texts.slice(0, 10).join(' | ')}`);
  }

  return lines.join('\n');
}

// ==================== EXPORTS ====================

export default {
  // Status
  isServiceEnabled,
  openAccessibilitySettings,

  // Screen reading
  getScreenContent,
  findElements,

  // Actions
  click,
  clickText,
  longPress,
  swipe,
  typeText,
  scroll,
  pressBack,
  pressHome,
  openApp,
  openNotifications,
  takeScreenshot,

  // Autonomous
  executeAction,
  runAutonomousTask,
  stopAutonomousTask,
  parseActionsFromResponse,
  getAppPackage
};
