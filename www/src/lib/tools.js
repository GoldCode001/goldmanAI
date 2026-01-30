/**
 * PAL Tools Engine
 * Enables PAL to take real actions via Gemini function calling
 * Includes autonomous agent capabilities for Android
 */

import { supabase } from './supabase.js';
import * as Agent from './autonomousAgent.js';
import * as DesktopAgent from './desktopAgent.js';

const API = "https://aibackend-production-a44f.up.railway.app";

// Check if we're on Android with agent support
let agentAvailable = false;
let desktopAgentAvailable = false;
let platformType = 'web'; // 'android', 'desktop', or 'web'
let aiDecisionCallback = null; // For autonomous task AI decisions

// Initialize agent detection
Agent.isServiceEnabled().then(enabled => {
  agentAvailable = enabled;
  if (enabled) platformType = 'android';
  console.log('[Tools] Android agent available:', enabled);
}).catch(() => {
  agentAvailable = false;
});

DesktopAgent.initDesktopAgent().then(available => {
  desktopAgentAvailable = available;
  if (available) platformType = 'desktop';
  console.log('[Tools] Desktop agent available:', available);
}).catch(() => {
  desktopAgentAvailable = false;
});

/**
 * Set the AI decision callback for autonomous tasks
 * This should be called by the app with a function that queries Gemini
 */
export function setAIDecisionCallback(callback) {
  aiDecisionCallback = callback;
  console.log('[Tools] AI decision callback set');
}

/**
 * Set desktop agent availability (called from app.js after Tauri init)
 */
export function setDesktopAgentAvailable(available) {
  desktopAgentAvailable = available;
  if (available && !agentAvailable) {
    platformType = 'desktop';
  }
  console.log('[Tools] Desktop agent manually set to:', available);
}

/**
 * Refresh agent availability status
 */
export async function refreshAgentStatus() {
  try {
    // Check Android agent
    agentAvailable = await Agent.isServiceEnabled();

    // Check desktop agent
    desktopAgentAvailable = await DesktopAgent.initDesktopAgent();

    // Set platform type
    if (agentAvailable) platformType = 'android';
    else if (desktopAgentAvailable) platformType = 'desktop';
    else platformType = 'web';

    console.log('[Tools] Agent status refreshed - Platform:', platformType);
    console.log('[Tools] desktopAgentAvailable:', desktopAgentAvailable);

    // DEBUG: Show platform type visually
    if (document.body) {
      const platformDiv = document.createElement('div');
      platformDiv.style.cssText = 'position:fixed;top:200px;left:10px;background:purple;color:white;padding:10px;z-index:99999;font-size:14px;font-weight:bold;max-width:300px;';
      platformDiv.innerHTML = `Platform: ${platformType}<br>Desktop Available: ${desktopAgentAvailable}`;
      document.body.appendChild(platformDiv);
      setTimeout(() => platformDiv.remove(), 15000);
    }

    return agentAvailable || desktopAgentAvailable;
  } catch (e) {
    agentAvailable = false;
    desktopAgentAvailable = false;
    platformType = 'web';

    // DEBUG: Show error
    if (document.body) {
      const errorDiv = document.createElement('div');
      errorDiv.style.cssText = 'position:fixed;top:200px;left:10px;background:orange;color:black;padding:10px;z-index:99999;font-size:12px;max-width:300px;';
      errorDiv.innerHTML = `Platform detection ERROR:<br>${e.message}`;
      document.body.appendChild(errorDiv);
      setTimeout(() => errorDiv.remove(), 15000);
    }

    return false;
  }
}

/**
 * Get current platform type
 */
export function getPlatformType() {
  return platformType;
}

// ============ TOOL DEFINITIONS FOR GEMINI ============

export const toolDefinitions = [
  // Memory Tools
  {
    name: 'remember_fact',
    description: 'Remember an important fact about the user for future reference. Use when user says "remember that...", "don\'t forget...", or shares personal info.',
    parameters: {
      type: 'object',
      properties: {
        fact: { type: 'string', description: 'The fact to remember' },
        category: { type: 'string', enum: ['personal', 'preference', 'work', 'health', 'other'], description: 'Category of the fact' }
      },
      required: ['fact']
    }
  },
  {
    name: 'recall_facts',
    description: 'Recall stored facts about the user. Use when user asks "what do you know about me?" or you need context.',
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Optional category to filter by' }
      },
      required: []
    }
  },

  // Goal Tools
  {
    name: 'create_goal',
    description: 'Create a new goal for the user to track. Use when user mentions wanting to achieve something.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Goal title' },
        description: { type: 'string', description: 'Goal description' },
        target_date: { type: 'string', description: 'Target completion date (optional)' }
      },
      required: ['title']
    }
  },
  {
    name: 'update_goal',
    description: 'Update progress on a goal or mark it complete.',
    parameters: {
      type: 'object',
      properties: {
        goal_id: { type: 'string', description: 'Goal ID' },
        status: { type: 'string', enum: ['active', 'completed', 'paused'], description: 'New status' },
        progress_note: { type: 'string', description: 'Progress update note' }
      },
      required: ['goal_id']
    }
  },
  {
    name: 'get_goals',
    description: 'Get the user\'s current goals.',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['active', 'completed', 'all'], description: 'Filter by status' }
      },
      required: []
    }
  },

  // Habit Tools
  {
    name: 'create_habit',
    description: 'Create a new habit to track. Use when user wants to build a habit.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Habit title (e.g., "Exercise", "Read", "Meditate")' },
        frequency: { type: 'string', enum: ['daily', 'weekly'], description: 'How often' }
      },
      required: ['title']
    }
  },
  {
    name: 'log_habit',
    description: 'Log that the user completed a habit today. Updates their streak.',
    parameters: {
      type: 'object',
      properties: {
        habit_id: { type: 'string', description: 'Habit ID' },
        notes: { type: 'string', description: 'Optional notes' }
      },
      required: ['habit_id']
    }
  },
  {
    name: 'get_habits',
    description: 'Get the user\'s habits with current streaks.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },

  // Reminder Tools
  {
    name: 'set_reminder',
    description: 'Set a reminder for the user. Use when they say "remind me to..."',
    parameters: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'What to remind them about' },
        time: { type: 'string', description: 'When to remind (e.g., "in 30 minutes", "at 3pm", "tomorrow at 9am")' }
      },
      required: ['message', 'time']
    }
  },

  // Utility Tools
  {
    name: 'get_datetime',
    description: 'Get the current date and time.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'web_search',
    description: 'Search the web for current information. Use for news, facts, or anything you\'re unsure about.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' }
      },
      required: ['query']
    }
  },

  // ============ AUTONOMOUS AGENT TOOLS ============
  // These tools let PAL control the Android device

  {
    name: 'open_app',
    description: 'Open an app on the device. Use when user asks to open Chrome, YouTube, Instagram, WhatsApp, Settings, etc.',
    parameters: {
      type: 'object',
      properties: {
        app_name: { type: 'string', description: 'Name of the app (e.g., "chrome", "youtube", "instagram", "whatsapp", "settings")' }
      },
      required: ['app_name']
    }
  },
  {
    name: 'click_on_screen',
    description: 'Click on an element on the screen by its text. Use to tap buttons, links, or any clickable element.',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'The text of the element to click' }
      },
      required: ['text']
    }
  },
  {
    name: 'type_text',
    description: 'Type text into the currently focused input field. Use after clicking on a text field.',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'The text to type' }
      },
      required: ['text']
    }
  },
  {
    name: 'scroll_screen',
    description: 'Scroll the screen in a direction. Use to see more content.',
    parameters: {
      type: 'object',
      properties: {
        direction: { type: 'string', enum: ['up', 'down', 'left', 'right'], description: 'Direction to scroll' }
      },
      required: ['direction']
    }
  },
  {
    name: 'go_back',
    description: 'Press the back button. Use to navigate back in apps.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'go_home',
    description: 'Press the home button to go to the home screen.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'get_screen_content',
    description: 'See what is currently on the screen. Use to understand the current state before taking action.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'run_autonomous_task',
    description: '**ANDROID ONLY** - Run a multi-step autonomous task on Android device. Requires accessibility service enabled. DO NOT use on desktop/Windows - use run_desktop_task instead. Use for Android tasks like "send a message to John on WhatsApp" or "search for cats on YouTube".',
    parameters: {
      type: 'object',
      properties: {
        goal: { type: 'string', description: 'The goal to achieve (e.g., "Open YouTube and search for cooking videos")' },
        max_steps: { type: 'number', description: 'Maximum steps to try (default 15)' }
      },
      required: ['goal']
    }
  },
  {
    name: 'check_agent_status',
    description: 'Check if the autonomous agent is enabled. If not, guide the user to enable it in accessibility settings.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },

  // ============ DESKTOP AGENT TOOLS ============
  // These tools let PAL control desktop computers (Windows, macOS, Linux)

  {
    name: 'run_command',
    description: '**PRIMARY TOOL FOR SIMPLE TASKS** - Run ONE shell command on desktop. USE THIS to open apps (e.g., "start telegram"), run programs, execute commands. For SIMPLE single-step actions ONLY. If task needs multiple steps, use run_desktop_task instead. Available on desktop only.',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Single shell command (e.g., "start telegram", "start chrome", "notepad", "python script.py")' }
      },
      required: ['command']
    }
  },
  {
    name: 'open_external',
    description: 'Open a URL or file in the default application. Works with URLs, file paths, etc. Available on desktop only.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'URL or file path to open (e.g., "https://google.com", "/path/to/file.pdf")' }
      },
      required: ['path']
    }
  },
  {
    name: 'read_file',
    description: 'Read contents of a file on the desktop. Available on desktop only.',
    parameters: {
      type: 'object',
      properties: {
        filepath: { type: 'string', description: 'Path to the file to read' }
      },
      required: ['filepath']
    }
  },
  {
    name: 'write_file',
    description: 'Write content to a file on the desktop. Creates or overwrites the file. Available on desktop only.',
    parameters: {
      type: 'object',
      properties: {
        filepath: { type: 'string', description: 'Path to the file to write' },
        content: { type: 'string', description: 'Content to write to the file' }
      },
      required: ['filepath', 'content']
    }
  },
  {
    name: 'list_files',
    description: 'List files in a directory on the desktop. Available on desktop only.',
    parameters: {
      type: 'object',
      properties: {
        directory: { type: 'string', description: 'Directory path (defaults to current directory)' }
      },
      required: []
    }
  },
  {
    name: 'create_directory',
    description: 'Create a new directory on the desktop. Available on desktop only.',
    parameters: {
      type: 'object',
      properties: {
        dirpath: { type: 'string', description: 'Path of directory to create' }
      },
      required: ['dirpath']
    }
  },
  {
    name: 'get_platform_info',
    description: 'Get information about the current platform (OS, architecture). Available on desktop only.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'run_desktop_task',
    description: '**COMPLEX MULTI-STEP TASKS ONLY** - Run autonomous task requiring MULTIPLE commands/steps. DO NOT use for simple app opening (use run_command instead). ONLY use for complex goals like "create a script to organize downloads" or "set up a new project with npm". Available on desktop only.',
    parameters: {
      type: 'object',
      properties: {
        goal: { type: 'string', description: 'Complex goal requiring multiple steps (e.g., "Create Python script to sort downloads by date and organize into folders")' },
        max_steps: { type: 'number', description: 'Maximum steps to try (default 20)' }
      },
      required: ['goal']
    }
  },

  // ============ MOUSE CONTROL TOOLS ============
  {
    name: 'mouse_move',
    description: 'Move the mouse cursor to specific screen coordinates. Desktop only.',
    parameters: {
      type: 'object',
      properties: {
        x: { type: 'number', description: 'X coordinate on screen' },
        y: { type: 'number', description: 'Y coordinate on screen' }
      },
      required: ['x', 'y']
    }
  },
  {
    name: 'mouse_click',
    description: 'Click a mouse button at current position. Desktop only.',
    parameters: {
      type: 'object',
      properties: {
        button: { type: 'string', description: 'Mouse button to click: "left", "right", or "middle" (default: "left")' }
      },
      required: []
    }
  },
  {
    name: 'mouse_scroll',
    description: 'Scroll the mouse wheel. Desktop only.',
    parameters: {
      type: 'object',
      properties: {
        amount: { type: 'number', description: 'Scroll amount (positive = down, negative = up)' }
      },
      required: ['amount']
    }
  },
  {
    name: 'get_mouse_position',
    description: 'Get current mouse cursor position. Desktop only.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },

  // ============ KEYBOARD CONTROL TOOLS ============
  {
    name: 'keyboard_type',
    description: 'Type text using the keyboard as if the user is typing. Desktop only.',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to type' }
      },
      required: ['text']
    }
  },
  {
    name: 'keyboard_press',
    description: 'Press a special keyboard key (Enter, Tab, Escape, Arrow keys, etc.). Desktop only.',
    parameters: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Key name: "enter", "tab", "escape", "backspace", "delete", "up", "down", "left", "right", "home", "end", "pageup", "pagedown", "space", "shift", "ctrl", "alt", "meta"' }
      },
      required: ['key']
    }
  },
  {
    name: 'keyboard_shortcut',
    description: 'Execute a keyboard shortcut (e.g., Ctrl+C, Alt+Tab). Desktop only.',
    parameters: {
      type: 'object',
      properties: {
        keys: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of keys to press together (e.g., ["ctrl", "c"] for Ctrl+C, ["alt", "tab"] for Alt+Tab)'
        }
      },
      required: ['keys']
    }
  },

  // ============ BROWSER AUTOMATION TOOLS ============
  {
    name: 'browser_open',
    description: 'Open a URL in the default web browser. Desktop only.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to open (e.g., "https://twitter.com")' }
      },
      required: ['url']
    }
  },
  {
    name: 'browser_automate',
    description: 'Automate browser actions using Playwright (navigate, click, fill forms, screenshot, etc.). Desktop only. Requires Playwright installed.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'Action to perform: "navigate", "click", "type", "screenshot", "evaluate"' },
        selector: { type: 'string', description: 'CSS selector for element (for click/type actions)' },
        value: { type: 'string', description: 'Value to type or URL to navigate to' }
      },
      required: ['action']
    }
  }
];

// ============ HELPER FUNCTIONS ============

async function getUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id;
}

async function getMemory() {
  const userId = await getUserId();
  if (!userId) return {};

  try {
    const res = await fetch(`${API}/api/user/memory?userId=${userId}`);
    const data = await res.json();
    return data.memory || {};
  } catch (e) {
    console.error('Failed to get memory:', e);
    return {};
  }
}

async function saveMemory(memory) {
  const userId = await getUserId();
  if (!userId) return false;

  try {
    await fetch(`${API}/api/user/memory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, memory })
    });
    return true;
  } catch (e) {
    console.error('Failed to save memory:', e);
    return false;
  }
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function parseTimeString(timeStr) {
  const now = new Date();
  const lower = timeStr.toLowerCase();

  // "in X minutes/hours"
  const inMatch = lower.match(/in\s+(\d+)\s*(minutes?|mins?|hours?|hrs?)/);
  if (inMatch) {
    const amount = parseInt(inMatch[1]);
    const unit = inMatch[2];
    if (unit.startsWith('hour') || unit.startsWith('hr')) {
      return new Date(now.getTime() + amount * 60 * 60 * 1000);
    } else {
      return new Date(now.getTime() + amount * 60 * 1000);
    }
  }

  // "at X pm/am"
  const atMatch = lower.match(/at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (atMatch) {
    let hours = parseInt(atMatch[1]);
    const minutes = parseInt(atMatch[2] || '0');
    const period = atMatch[3];

    if (period === 'pm' && hours < 12) hours += 12;
    if (period === 'am' && hours === 12) hours = 0;

    const result = new Date(now);
    result.setHours(hours, minutes, 0, 0);

    // If time already passed today, set for tomorrow
    if (result <= now) {
      result.setDate(result.getDate() + 1);
    }
    return result;
  }

  // "tomorrow"
  if (lower.includes('tomorrow')) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const timeMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2] || '0');
      const period = timeMatch[3];

      if (period === 'pm' && hours < 12) hours += 12;
      if (period === 'am' && hours === 12) hours = 0;

      tomorrow.setHours(hours, minutes, 0, 0);
    } else {
      tomorrow.setHours(9, 0, 0, 0); // Default to 9am
    }
    return tomorrow;
  }

  // Default: 1 hour from now
  return new Date(now.getTime() + 60 * 60 * 1000);
}

// ============ TOOL EXECUTORS ============

const executors = {
  // Memory
  async remember_fact({ fact, category = 'other' }) {
    const memory = await getMemory();
    if (!memory.facts) memory.facts = [];

    memory.facts.push({
      id: generateId(),
      fact,
      category,
      timestamp: new Date().toISOString()
    });

    await saveMemory(memory);
    return { success: true, message: `Got it, I'll remember that.` };
  },

  async recall_facts({ category }) {
    const memory = await getMemory();
    let facts = memory.facts || [];

    if (category) {
      facts = facts.filter(f => f.category === category);
    }

    if (facts.length === 0) {
      return { success: true, facts: [], message: "I don't have any facts stored yet." };
    }

    return { success: true, facts: facts.map(f => f.fact) };
  },

  // Goals
  async create_goal({ title, description, target_date }) {
    const memory = await getMemory();
    if (!memory.goals) memory.goals = [];

    const goal = {
      id: generateId(),
      title,
      description: description || '',
      target_date: target_date || null,
      status: 'active',
      created: new Date().toISOString(),
      progress: []
    };

    memory.goals.push(goal);
    await saveMemory(memory);

    return { success: true, goal_id: goal.id, message: `Created goal: "${title}"` };
  },

  async update_goal({ goal_id, status, progress_note }) {
    const memory = await getMemory();
    if (!memory.goals) return { success: false, error: 'No goals found' };

    const goal = memory.goals.find(g => g.id === goal_id);
    if (!goal) return { success: false, error: 'Goal not found' };

    if (status) goal.status = status;
    if (progress_note) {
      goal.progress.push({
        note: progress_note,
        timestamp: new Date().toISOString()
      });
    }

    await saveMemory(memory);
    return { success: true, message: status === 'completed' ? 'Congrats on completing your goal!' : 'Goal updated.' };
  },

  async get_goals({ status = 'active' }) {
    const memory = await getMemory();
    let goals = memory.goals || [];

    if (status !== 'all') {
      goals = goals.filter(g => g.status === status);
    }

    return { success: true, goals };
  },

  // Habits
  async create_habit({ title, frequency = 'daily' }) {
    const memory = await getMemory();
    if (!memory.habits) memory.habits = [];

    const habit = {
      id: generateId(),
      title,
      frequency,
      streak: 0,
      lastCompleted: null,
      created: new Date().toISOString()
    };

    memory.habits.push(habit);
    await saveMemory(memory);

    return { success: true, habit_id: habit.id, message: `Started tracking habit: "${title}"` };
  },

  async log_habit({ habit_id, notes }) {
    const memory = await getMemory();
    if (!memory.habits) return { success: false, error: 'No habits found' };

    const habit = memory.habits.find(h => h.id === habit_id);
    if (!habit) return { success: false, error: 'Habit not found' };

    const today = new Date().toDateString();
    const lastDate = habit.lastCompleted ? new Date(habit.lastCompleted).toDateString() : null;

    if (lastDate === today) {
      return { success: true, message: `You already logged "${habit.title}" today! Streak: ${habit.streak} days` };
    }

    // Check if streak continues or resets
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (lastDate === yesterday.toDateString()) {
      habit.streak += 1;
    } else {
      habit.streak = 1;
    }

    habit.lastCompleted = new Date().toISOString();
    await saveMemory(memory);

    return { success: true, streak: habit.streak, message: `Nice! "${habit.title}" logged. Streak: ${habit.streak} days!` };
  },

  async get_habits() {
    const memory = await getMemory();
    const habits = memory.habits || [];

    return { success: true, habits };
  },

  // Reminders
  async set_reminder({ message, time }) {
    const reminderTime = parseTimeString(time);
    const memory = await getMemory();
    if (!memory.reminders) memory.reminders = [];

    const reminder = {
      id: generateId(),
      message,
      time: reminderTime.toISOString(),
      created: new Date().toISOString()
    };

    memory.reminders.push(reminder);
    await saveMemory(memory);

    // Schedule browser notification
    const delay = reminderTime.getTime() - Date.now();
    if (delay > 0) {
      setTimeout(() => {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('PAL Reminder', { body: message });
        }
        // Also dispatch event for in-app handling
        window.dispatchEvent(new CustomEvent('pal-reminder', { detail: { message } }));
      }, delay);
    }

    const timeStr = reminderTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return { success: true, message: `Reminder set for ${timeStr}: "${message}"` };
  },

  // Utilities
  async get_datetime() {
    const now = new Date();
    return {
      success: true,
      date: now.toLocaleDateString(),
      time: now.toLocaleTimeString(),
      day: now.toLocaleDateString('en-US', { weekday: 'long' }),
      iso: now.toISOString()
    };
  },

  async web_search({ query }) {
    // Use a simple search API or return guidance
    try {
      const res = await fetch(`${API}/api/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        return { success: true, results: data.results };
      }
    } catch (e) {
      console.warn('Search API not available');
    }

    // Fallback: return that search isn't available
    return {
      success: false,
      message: `I don't have web search available right now, but you can search for: "${query}"`
    };
  },

  // ============ AUTONOMOUS AGENT EXECUTORS ============

  async open_app({ app_name }) {
    if (!agentAvailable) {
      return { success: false, error: 'Agent not enabled. Ask user to enable accessibility service.' };
    }

    const pkg = Agent.getAppPackage(app_name);
    const success = await Agent.openApp(pkg);

    if (success) {
      return { success: true, message: `Opened ${app_name}` };
    } else {
      return { success: false, error: `Failed to open ${app_name}. App might not be installed.` };
    }
  },

  async click_on_screen({ text }) {
    if (!agentAvailable) {
      return { success: false, error: 'Agent not enabled. Ask user to enable accessibility service.' };
    }

    const success = await Agent.clickText(text);

    if (success) {
      return { success: true, message: `Clicked on "${text}"` };
    } else {
      return { success: false, error: `Could not find or click "${text}" on screen` };
    }
  },

  async type_text({ text }) {
    if (!agentAvailable) {
      return { success: false, error: 'Agent not enabled. Ask user to enable accessibility service.' };
    }

    const success = await Agent.typeText(text);

    if (success) {
      return { success: true, message: `Typed: "${text}"` };
    } else {
      return { success: false, error: 'Failed to type text. Make sure a text field is focused.' };
    }
  },

  async scroll_screen({ direction }) {
    if (!agentAvailable) {
      return { success: false, error: 'Agent not enabled. Ask user to enable accessibility service.' };
    }

    const success = await Agent.scroll(direction);

    if (success) {
      return { success: true, message: `Scrolled ${direction}` };
    } else {
      return { success: false, error: 'Failed to scroll' };
    }
  },

  async go_back() {
    if (!agentAvailable) {
      return { success: false, error: 'Agent not enabled. Ask user to enable accessibility service.' };
    }

    const success = await Agent.pressBack();

    if (success) {
      return { success: true, message: 'Pressed back' };
    } else {
      return { success: false, error: 'Failed to press back' };
    }
  },

  async go_home() {
    if (!agentAvailable) {
      return { success: false, error: 'Agent not enabled. Ask user to enable accessibility service.' };
    }

    const success = await Agent.pressHome();

    if (success) {
      return { success: true, message: 'Went to home screen' };
    } else {
      return { success: false, error: 'Failed to go home' };
    }
  },

  async get_screen_content() {
    if (!agentAvailable) {
      return { success: false, error: 'Agent not enabled. Ask user to enable accessibility service.' };
    }

    const screen = await Agent.getScreenContent();

    if (screen) {
      // Format screen content for AI understanding
      const elements = screen.elements || [];
      const clickable = elements.filter(e => e.clickable && (e.text || e.contentDescription));
      const texts = elements.filter(e => e.text && !e.clickable).map(e => e.text);

      return {
        success: true,
        app: screen.packageName,
        clickable_elements: clickable.slice(0, 20).map(e => e.text || e.contentDescription),
        visible_text: texts.slice(0, 15),
        element_count: elements.length
      };
    } else {
      return { success: false, error: 'Could not read screen' };
    }
  },

  async run_autonomous_task({ goal, max_steps = 15 }) {
    if (!agentAvailable) {
      return { success: false, error: 'Agent not enabled. Ask user to enable accessibility service.' };
    }

    if (!aiDecisionCallback) {
      return { success: false, error: 'AI decision callback not configured. Cannot run autonomous task.' };
    }

    return new Promise((resolve) => {
      Agent.runAutonomousTask(goal, {
        maxSteps: max_steps,
        onStep: (step) => {
          console.log(`[Tools] Autonomous step ${step.step}:`, step.action);
          // Dispatch event so UI can show progress
          window.dispatchEvent(new CustomEvent('pal-agent-step', {
            detail: { step: step.step, action: step.action, goal }
          }));
        },
        onComplete: (result) => {
          window.dispatchEvent(new CustomEvent('pal-agent-complete', {
            detail: { success: true, message: result.message, steps: result.steps }
          }));
          resolve({
            success: true,
            message: result.message,
            steps_taken: result.steps
          });
        },
        onError: (error) => {
          window.dispatchEvent(new CustomEvent('pal-agent-complete', {
            detail: { success: false, error: error.message, steps: error.steps }
          }));
          resolve({
            success: false,
            error: error.message,
            steps_taken: error.steps
          });
        },
        getAIDecision: aiDecisionCallback
      });
    });
  },

  async check_agent_status() {
    const enabled = await Agent.isServiceEnabled();

    if (enabled) {
      return {
        success: true,
        enabled: true,
        message: 'Autonomous agent is enabled and ready!'
      };
    } else {
      // Try to open settings
      await Agent.openAccessibilitySettings();
      return {
        success: true,
        enabled: false,
        message: 'Accessibility service is not enabled. I\'ve opened the settings - please find "PAL" or "Goldman AI" and enable it to let me control the device.'
      };
    }
  },

  // ============ DESKTOP AGENT EXECUTORS ============

  async run_command({ command }) {
    console.log('[Tools] run_command called with:', command);
    console.log('[Tools] desktopAgentAvailable:', desktopAgentAvailable);
    console.log('[Tools] platformType:', platformType);

    if (!desktopAgentAvailable) {
      console.error('[Tools] run_command FAILED: Desktop agent not available');
      return { success: false, error: 'Desktop agent not available. This feature only works on desktop apps.' };
    }

    // Show command execution visually
    if (document.body) {
      const cmdDiv = document.createElement('div');
      cmdDiv.style.cssText = 'position:fixed;top:500px;left:10px;background:lime;color:black;padding:10px;z-index:99999;font-size:12px;font-weight:bold;max-width:300px;';
      cmdDiv.innerHTML = `EXECUTING:<br>${command}`;
      document.body.appendChild(cmdDiv);
      setTimeout(() => cmdDiv.remove(), 5000);
    }

    console.log('[Tools] Calling DesktopAgent.runShellCommand...');
    const result = await DesktopAgent.runShellCommand(command);
    console.log('[Tools] Result:', result);

    if (result.success) {
      return {
        success: true,
        output: result.output,
        message: `Executed: ${command}`
      };
    } else {
      return {
        success: false,
        error: result.error,
        command: command
      };
    }
  },

  async open_external({ path }) {
    if (!desktopAgentAvailable) {
      return { success: false, error: 'Desktop agent not available. This feature only works on desktop apps.' };
    }

    const result = await DesktopAgent.openExternal(path);

    if (result.success) {
      return { success: true, message: `Opened: ${path}` };
    } else {
      return { success: false, error: result.error };
    }
  },

  async read_file({ filepath }) {
    if (!desktopAgentAvailable) {
      return { success: false, error: 'Desktop agent not available. This feature only works on desktop apps.' };
    }

    const result = await DesktopAgent.readFile(filepath);

    if (result.success) {
      return {
        success: true,
        content: result.output,
        filepath: filepath
      };
    } else {
      return {
        success: false,
        error: result.error,
        filepath: filepath
      };
    }
  },

  async write_file({ filepath, content }) {
    console.log('[Tools] write_file called with:', filepath);
    console.log('[Tools] desktopAgentAvailable:', desktopAgentAvailable);

    if (!desktopAgentAvailable) {
      console.error('[Tools] write_file FAILED: Desktop agent not available');
      return { success: false, error: 'Desktop agent not available. This feature only works on desktop apps.' };
    }

    console.log('[Tools] Calling DesktopAgent.writeFile...');
    const result = await DesktopAgent.writeFile(filepath, content);
    console.log('[Tools] Result:', result);

    if (result.success) {
      return {
        success: true,
        message: `Wrote to file: ${filepath}`,
        filepath: filepath
      };
    } else {
      return {
        success: false,
        error: result.error,
        filepath: filepath
      };
    }
  },

  async list_files({ directory }) {
    if (!desktopAgentAvailable) {
      return { success: false, error: 'Desktop agent not available. This feature only works on desktop apps.' };
    }

    const files = await DesktopAgent.listFiles(directory);

    return {
      success: true,
      files: files,
      directory: directory || 'current directory'
    };
  },

  async create_directory({ dirpath }) {
    if (!desktopAgentAvailable) {
      return { success: false, error: 'Desktop agent not available. This feature only works on desktop apps.' };
    }

    const result = await DesktopAgent.createDirectory(dirpath);

    if (result.success) {
      return {
        success: true,
        message: `Created directory: ${dirpath}`,
        dirpath: dirpath
      };
    } else {
      return {
        success: false,
        error: result.error,
        dirpath: dirpath
      };
    }
  },

  async get_platform_info() {
    if (!desktopAgentAvailable) {
      return { success: false, error: 'Desktop agent not available. This feature only works on desktop apps.' };
    }

    const info = DesktopAgent.getPlatformInfo();

    return {
      success: true,
      platform: info
    };
  },

  async run_desktop_task({ goal, max_steps = 20 }) {
    if (!desktopAgentAvailable) {
      return { success: false, error: 'Desktop agent not available. This feature only works on desktop apps.' };
    }

    if (!aiDecisionCallback) {
      return { success: false, error: 'AI decision callback not configured. Cannot run autonomous task.' };
    }

    return new Promise((resolve) => {
      DesktopAgent.runDesktopTask(goal, {
        maxSteps: max_steps,
        onStep: (step) => {
          console.log(`[Tools] Desktop task step ${step.step}:`, step.decision);
          window.dispatchEvent(new CustomEvent('pal-desktop-step', {
            detail: { step: step.step, decision: step.decision, goal }
          }));
        },
        onComplete: (result) => {
          window.dispatchEvent(new CustomEvent('pal-desktop-complete', {
            detail: { success: true, message: result.message, steps: result.steps }
          }));
          resolve({
            success: true,
            message: `Desktop task completed in ${result.steps} steps`,
            steps_taken: result.steps
          });
        },
        onError: (error) => {
          window.dispatchEvent(new CustomEvent('pal-desktop-complete', {
            detail: { success: false, error: error.toString(), steps: error.steps }
          }));
          resolve({
            success: false,
            error: error.toString(),
            steps_taken: error.steps || 0
          });
        },
        getAIDecision: aiDecisionCallback
      });
    });
  },

  // ============ MOUSE CONTROL EXECUTORS ============

  async mouse_move({ x, y }) {
    if (!desktopAgentAvailable) {
      return { success: false, error: 'Desktop agent not available. Mouse control only works on desktop apps.' };
    }

    const result = await DesktopAgent.mouseMove(x, y);
    return result;
  },

  async mouse_click({ button = 'left' }) {
    if (!desktopAgentAvailable) {
      return { success: false, error: 'Desktop agent not available. Mouse control only works on desktop apps.' };
    }

    const result = await DesktopAgent.mouseClick(button);
    return result;
  },

  async mouse_scroll({ amount }) {
    if (!desktopAgentAvailable) {
      return { success: false, error: 'Desktop agent not available. Mouse control only works on desktop apps.' };
    }

    const result = await DesktopAgent.mouseScroll(amount);
    return result;
  },

  async get_mouse_position() {
    if (!desktopAgentAvailable) {
      return { success: false, error: 'Desktop agent not available. Mouse control only works on desktop apps.' };
    }

    const result = await DesktopAgent.getMousePosition();
    return result;
  },

  // ============ KEYBOARD CONTROL EXECUTORS ============

  async keyboard_type({ text }) {
    if (!desktopAgentAvailable) {
      return { success: false, error: 'Desktop agent not available. Keyboard control only works on desktop apps.' };
    }

    const result = await DesktopAgent.keyboardType(text);
    return result;
  },

  async keyboard_press({ key }) {
    if (!desktopAgentAvailable) {
      return { success: false, error: 'Desktop agent not available. Keyboard control only works on desktop apps.' };
    }

    const result = await DesktopAgent.keyboardPress(key);
    return result;
  },

  async keyboard_shortcut({ keys }) {
    if (!desktopAgentAvailable) {
      return { success: false, error: 'Desktop agent not available. Keyboard control only works on desktop apps.' };
    }

    const result = await DesktopAgent.keyboardShortcut(keys);
    return result;
  },

  // ============ BROWSER AUTOMATION EXECUTORS ============

  async browser_open({ url }) {
    if (!desktopAgentAvailable) {
      return { success: false, error: 'Desktop agent not available. Browser automation only works on desktop apps.' };
    }

    const result = await DesktopAgent.browserOpen(url);
    return result;
  },

  async browser_automate({ action, selector, value }) {
    if (!desktopAgentAvailable) {
      return { success: false, error: 'Desktop agent not available. Browser automation only works on desktop apps.' };
    }

    // Build a simple Playwright script based on the action
    let script = `
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
`;

    switch (action) {
      case 'navigate':
        script += `  await page.goto('${value}');\n`;
        script += `  await page.waitForLoadState('networkidle');\n`;
        break;
      case 'click':
        script += `  await page.click('${selector}');\n`;
        break;
      case 'type':
        script += `  await page.fill('${selector}', '${value}');\n`;
        break;
      case 'screenshot':
        script += `  await page.screenshot({ path: '${value || 'screenshot.png'}' });\n`;
        break;
      case 'evaluate':
        script += `  const result = await page.evaluate(() => ${value});\n`;
        script += `  console.log(JSON.stringify(result));\n`;
        break;
      default:
        return { success: false, error: `Unknown browser action: ${action}` };
    }

    script += `  await browser.close();\n`;
    script += `})();`;

    const result = await DesktopAgent.runPlaywrightScript(script);
    return result;
  }
};

// ============ MAIN HANDLER ============

/**
 * Execute a tool by name
 */
export async function executeTool(name, args) {
  console.log(`[Tools] Executing: ${name}`, args);

  const executor = executors[name];
  if (!executor) {
    return { success: false, error: `Unknown tool: ${name}` };
  }

  try {
    const result = await executor(args);
    console.log(`[Tools] Result:`, result);
    return result;
  } catch (e) {
    console.error(`[Tools] Error:`, e);
    return { success: false, error: e.message };
  }
}

/**
 * Get tool definitions formatted for Gemini
 */
export async function getToolsForGemini() {
  // Ensure platform detection is complete before filtering tools
  console.log('[Tools] Platform type before refresh:', platformType);
  await refreshAgentStatus();
  console.log('[Tools] Platform type after refresh:', platformType);

  // Filter tools based on current platform
  const filteredTools = toolDefinitions.filter(tool => {
    // Android-only tools
    const androidTools = [
      'open_app', 'click_on_screen', 'type_text', 'scroll_screen',
      'go_back', 'go_home', 'get_screen_content',
      'run_autonomous_task', 'check_agent_status'
    ];
    if (androidTools.includes(tool.name)) {
      return platformType === 'android';
    }

    // Desktop-only tools
    const desktopTools = [
      'run_command', 'open_external', 'read_file', 'write_file',
      'list_files', 'create_directory', 'run_desktop_task', 'get_platform_info',
      'mouse_move', 'mouse_click', 'mouse_scroll', 'get_mouse_position',
      'keyboard_type', 'keyboard_press', 'keyboard_shortcut',
      'browser_open', 'browser_automate'
    ];
    if (desktopTools.includes(tool.name)) {
      return platformType === 'desktop';
    }

    // All other tools are available on all platforms
    return true;
  });

  console.log('[Tools] ALL tools being registered:', filteredTools.length);
  console.log('[Tools] Desktop tools included:', filteredTools.filter(t => ['run_command', 'browser_open', 'keyboard_type'].includes(t.name)).length > 0);

  return filteredTools.map(tool => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters
  }));
}

export default {
  toolDefinitions,
  executeTool,
  getToolsForGemini,
  setAIDecisionCallback,
  setDesktopAgentAvailable,
  refreshAgentStatus
};
