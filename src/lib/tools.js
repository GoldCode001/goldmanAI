/**
 * PAL Tools Engine
 * Enables PAL to take real actions via Gemini function calling
 * All tools work on web - no Capacitor dependencies
 */

import { supabase } from './supabase.js';

const API = "https://aibackend-production-a44f.up.railway.app";

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
      }
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
      }
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
      properties: {}
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
      properties: {}
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
export function getToolsForGemini() {
  return toolDefinitions.map(tool => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters
  }));
}

export default {
  toolDefinitions,
  executeTool,
  getToolsForGemini
};
