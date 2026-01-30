/**
 * Proactive Reminders System for PAL
 * Checks for due reminders and triggers notifications
 * Also provides context for PAL to proactively mention upcoming reminders
 */

import { supabase } from './supabase.js';

const API = "https://aibackend-production-a44f.up.railway.app";

let checkInterval = null;
let onReminderDue = null;

/**
 * Initialize proactive reminders
 * @param {Function} callback - Called when a reminder is due
 */
export function initProactiveReminders(callback) {
  onReminderDue = callback;

  // Check immediately on init
  checkReminders();

  // Check every minute
  checkInterval = setInterval(checkReminders, 60 * 1000);

  console.log('[Reminders] Proactive reminders initialized');
}

/**
 * Stop proactive reminders
 */
export function stopProactiveReminders() {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
}

/**
 * Get user ID from Supabase
 */
async function getUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id;
}

/**
 * Get user's memory (where reminders are stored)
 */
async function getMemory() {
  const userId = await getUserId();
  if (!userId) return {};

  try {
    const res = await fetch(`${API}/api/user/memory?userId=${userId}`);
    const data = await res.json();
    return data.memory || {};
  } catch (e) {
    console.error('[Reminders] Failed to get memory:', e);
    return {};
  }
}

/**
 * Save memory back to server
 */
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
    console.error('[Reminders] Failed to save memory:', e);
    return false;
  }
}

/**
 * Check for due reminders
 */
async function checkReminders() {
  try {
    const memory = await getMemory();
    const reminders = memory.reminders || [];

    if (reminders.length === 0) return;

    const now = new Date();
    const dueReminders = [];
    const remainingReminders = [];

    for (const reminder of reminders) {
      const reminderTime = new Date(reminder.time);

      if (reminderTime <= now) {
        // Reminder is due
        dueReminders.push(reminder);
      } else {
        // Keep for later
        remainingReminders.push(reminder);
      }
    }

    // Process due reminders
    if (dueReminders.length > 0) {
      console.log('[Reminders] Due reminders:', dueReminders.length);

      // Update memory to remove processed reminders
      memory.reminders = remainingReminders;
      await saveMemory(memory);

      // Trigger notifications
      for (const reminder of dueReminders) {
        triggerReminder(reminder);
      }
    }
  } catch (e) {
    console.error('[Reminders] Error checking reminders:', e);
  }
}

/**
 * Trigger a reminder notification
 */
function triggerReminder(reminder) {
  console.log('[Reminders] Triggering reminder:', reminder.message);

  // Browser notification
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('PAL Reminder', {
      body: reminder.message,
      icon: '/assets/icon.png',
      tag: reminder.id
    });
  }

  // In-app callback
  if (onReminderDue) {
    onReminderDue(reminder);
  }

  // Dispatch event for other components
  window.dispatchEvent(new CustomEvent('pal-reminder', {
    detail: reminder
  }));
}

/**
 * Get upcoming reminders (for PAL to mention proactively)
 * @param {number} withinMinutes - Only return reminders due within this many minutes
 */
export async function getUpcomingReminders(withinMinutes = 60) {
  try {
    const memory = await getMemory();
    const reminders = memory.reminders || [];

    if (reminders.length === 0) return [];

    const now = new Date();
    const cutoff = new Date(now.getTime() + withinMinutes * 60 * 1000);

    return reminders.filter(reminder => {
      const reminderTime = new Date(reminder.time);
      return reminderTime > now && reminderTime <= cutoff;
    }).map(reminder => ({
      ...reminder,
      timeUntil: formatTimeUntil(new Date(reminder.time))
    }));
  } catch (e) {
    console.error('[Reminders] Error getting upcoming reminders:', e);
    return [];
  }
}

/**
 * Format time until reminder in human-readable form
 */
function formatTimeUntil(reminderTime) {
  const now = new Date();
  const diff = reminderTime.getTime() - now.getTime();

  const minutes = Math.floor(diff / (60 * 1000));
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `in ${hours} hour${hours > 1 ? 's' : ''}`;
  } else if (minutes > 0) {
    return `in ${minutes} minute${minutes > 1 ? 's' : ''}`;
  } else {
    return 'now';
  }
}

/**
 * Get today's habit status for proactive check-ins
 */
export async function getTodayHabitStatus() {
  try {
    const memory = await getMemory();
    const habits = memory.habits || [];

    if (habits.length === 0) return { habits: [], completed: [], pending: [] };

    const today = new Date().toDateString();

    const completed = [];
    const pending = [];

    for (const habit of habits) {
      const lastCompleted = habit.lastCompleted ? new Date(habit.lastCompleted).toDateString() : null;

      if (lastCompleted === today) {
        completed.push(habit);
      } else {
        pending.push(habit);
      }
    }

    return { habits, completed, pending };
  } catch (e) {
    console.error('[Reminders] Error getting habit status:', e);
    return { habits: [], completed: [], pending: [] };
  }
}

/**
 * Get proactive context for PAL (reminders + habits)
 * Call this when starting a conversation to give PAL context
 */
export async function getProactiveContext() {
  const [upcomingReminders, habitStatus] = await Promise.all([
    getUpcomingReminders(60),
    getTodayHabitStatus()
  ]);

  const context = [];

  // Upcoming reminders
  if (upcomingReminders.length > 0) {
    context.push(`Upcoming reminders: ${upcomingReminders.map(r => `"${r.message}" (${r.timeUntil})`).join(', ')}`);
  }

  // Pending habits
  if (habitStatus.pending.length > 0) {
    const pendingNames = habitStatus.pending.map(h => h.title).join(', ');
    context.push(`Habits not yet logged today: ${pendingNames}`);
  }

  // Completed habits (for encouragement)
  if (habitStatus.completed.length > 0) {
    const completedNames = habitStatus.completed.map(h => `${h.title} (${h.streak}-day streak)`).join(', ');
    context.push(`Habits completed today: ${completedNames}`);
  }

  return context.length > 0 ? context.join('\n') : null;
}

export default {
  initProactiveReminders,
  stopProactiveReminders,
  getUpcomingReminders,
  getTodayHabitStatus,
  getProactiveContext
};
