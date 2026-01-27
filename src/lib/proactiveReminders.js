/**
 * Proactive Reminders System
 * Checks for upcoming reminders, due habits, and goal progress
 * Sends notifications to keep users on track
 */

import { supabase } from './supabase.js';

const API = "https://aibackend-production-a44f.up.railway.app";

// Configuration
const CHECK_INTERVAL = 60000; // Check every minute
const REMINDER_LEAD_TIME = 5 * 60 * 1000; // Notify 5 minutes before
const HABIT_CHECK_TIMES = [9, 12, 18, 21]; // Hours to check habits (9am, 12pm, 6pm, 9pm)

// State
let checkInterval = null;
let lastHabitCheck = null;
let onNotificationCallback = null;
let isRunning = false;

/**
 * Initialize proactive reminders
 */
export function initProactiveReminders(options = {}) {
  if (options.onNotification) {
    onNotificationCallback = options.onNotification;
  }

  return true;
}

/**
 * Start the proactive reminders service
 */
export function startProactiveReminders() {
  if (isRunning) return;

  isRunning = true;
  console.log('[Proactive] Starting proactive reminders service');

  // Run initial check
  checkAll();

  // Set up interval
  checkInterval = setInterval(checkAll, CHECK_INTERVAL);
}

/**
 * Stop the proactive reminders service
 */
export function stopProactiveReminders() {
  if (!isRunning) return;

  isRunning = false;

  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }

  console.log('[Proactive] Stopped proactive reminders service');
}

/**
 * Run all checks
 */
async function checkAll() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await Promise.all([
      checkReminders(user.id),
      checkHabits(user.id),
      checkGoals(user.id)
    ]);
  } catch (err) {
    console.error('[Proactive] Error during check:', err);
  }
}

/**
 * Check for upcoming reminders
 */
async function checkReminders(userId) {
  try {
    const res = await fetch(`${API}/api/user/memory?userId=${userId}`);
    if (!res.ok) return;

    const data = await res.json();
    const reminders = data.memory?.reminders || [];
    const now = Date.now();

    for (const reminder of reminders) {
      if (reminder.notified) continue;

      const triggerTime = new Date(reminder.time).getTime();
      const timeUntil = triggerTime - now;

      // Check if reminder is due or coming up soon
      if (timeUntil <= 0) {
        // Reminder is due now
        await triggerReminder(userId, reminder, 'due');
      } else if (timeUntil <= REMINDER_LEAD_TIME && !reminder.preNotified) {
        // Reminder is coming up
        await triggerReminder(userId, reminder, 'upcoming');
      }
    }
  } catch (err) {
    console.error('[Proactive] Error checking reminders:', err);
  }
}

/**
 * Trigger a reminder notification
 */
async function triggerReminder(userId, reminder, type) {
  const title = type === 'due' ? 'Reminder' : 'Upcoming Reminder';
  const timeStr = type === 'upcoming' ? ' in 5 minutes' : '';
  const body = `${reminder.message}${timeStr}`;

  // Send notification
  sendNotification(title, body, {
    type: 'reminder',
    reminderId: reminder.id
  });

  // Mark as notified
  try {
    const res = await fetch(`${API}/api/user/memory?userId=${userId}`);
    const data = await res.json();
    const memory = data.memory || {};

    if (memory.reminders) {
      const idx = memory.reminders.findIndex(r => r.id === reminder.id);
      if (idx >= 0) {
        if (type === 'due') {
          memory.reminders[idx].notified = true;
        } else {
          memory.reminders[idx].preNotified = true;
        }

        await fetch(`${API}/api/user/memory`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, memory })
        });
      }
    }
  } catch (err) {
    console.error('[Proactive] Error marking reminder as notified:', err);
  }
}

/**
 * Check habits at appropriate times
 */
async function checkHabits(userId) {
  const now = new Date();
  const currentHour = now.getHours();

  // Only check at designated times
  if (!HABIT_CHECK_TIMES.includes(currentHour)) return;

  // Don't check more than once per hour
  if (lastHabitCheck) {
    const hoursSinceLastCheck = (now - lastHabitCheck) / (1000 * 60 * 60);
    if (hoursSinceLastCheck < 1) return;
  }

  lastHabitCheck = now;

  try {
    const res = await fetch(`${API}/api/user/memory?userId=${userId}`);
    if (!res.ok) return;

    const data = await res.json();
    const habits = data.memory?.habits || [];

    if (habits.length === 0) return;

    // Check which habits haven't been logged today
    const today = now.toDateString();
    const unloggedHabits = habits.filter(habit => {
      if (!habit.active) return false;

      // Check if logged today
      const lastLog = habit.logs?.find(log =>
        new Date(log.date).toDateString() === today
      );

      return !lastLog;
    });

    if (unloggedHabits.length === 0) return;

    // Create a friendly reminder
    if (unloggedHabits.length === 1) {
      sendNotification(
        'Habit Reminder',
        `Don't forget: ${unloggedHabits[0].title}`,
        { type: 'habit', habitId: unloggedHabits[0].id }
      );
    } else {
      sendNotification(
        'Habit Reminder',
        `You have ${unloggedHabits.length} habits to complete today!`,
        { type: 'habits', count: unloggedHabits.length }
      );
    }
  } catch (err) {
    console.error('[Proactive] Error checking habits:', err);
  }
}

/**
 * Check goals periodically
 */
async function checkGoals(userId) {
  // Only check goals once per day (at 9am)
  const now = new Date();
  if (now.getHours() !== 9) return;

  const today = now.toDateString();
  const lastGoalCheck = localStorage.getItem('lastGoalCheck');
  if (lastGoalCheck === today) return;

  localStorage.setItem('lastGoalCheck', today);

  try {
    const res = await fetch(`${API}/api/user/memory?userId=${userId}`);
    if (!res.ok) return;

    const data = await res.json();
    const goals = data.memory?.goals || [];

    const activeGoals = goals.filter(g => g.status === 'active');
    if (activeGoals.length === 0) return;

    // Check for goals with upcoming deadlines
    const upcomingDeadlines = activeGoals.filter(goal => {
      if (!goal.target_date) return false;

      const deadline = new Date(goal.target_date);
      const daysUntil = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));

      return daysUntil <= 7 && daysUntil > 0;
    });

    if (upcomingDeadlines.length > 0) {
      const goal = upcomingDeadlines[0];
      const deadline = new Date(goal.target_date);
      const daysUntil = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));

      sendNotification(
        'Goal Deadline Approaching',
        `"${goal.title}" is due in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`,
        { type: 'goal', goalId: goal.id }
      );
    } else if (activeGoals.length > 0) {
      // Weekly encouragement
      const dayOfWeek = now.getDay();
      if (dayOfWeek === 1) { // Monday motivation
        sendNotification(
          'Weekly Goals Check-in',
          `You have ${activeGoals.length} active goal${activeGoals.length !== 1 ? 's' : ''}. Keep going!`,
          { type: 'goals_summary' }
        );
      }
    }
  } catch (err) {
    console.error('[Proactive] Error checking goals:', err);
  }
}

/**
 * Send a notification
 */
function sendNotification(title, body, data = {}) {
  console.log(`[Proactive] Notification: ${title} - ${body}`);

  // Call the callback if set
  if (onNotificationCallback) {
    onNotificationCallback({ title, body, data });
  }

  // Try native notification
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: '/icon.png',
        tag: data.type || 'proactive',
        requireInteraction: false
      });
    } catch (err) {
      console.warn('[Proactive] Native notification failed:', err);
    }
  }

  // Try service worker notification (for PWA)
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'SHOW_NOTIFICATION',
      title,
      body,
      data
    });
  }
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission === 'denied') {
    return false;
  }

  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

/**
 * Manually add a quick reminder
 */
export async function addQuickReminder(message, minutesFromNow) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not logged in' };

    const res = await fetch(`${API}/api/user/memory?userId=${user.id}`);
    const data = await res.json();
    const memory = data.memory || {};

    if (!memory.reminders) memory.reminders = [];

    const reminder = {
      id: Date.now().toString(),
      message,
      time: new Date(Date.now() + minutesFromNow * 60 * 1000).toISOString(),
      created: new Date().toISOString(),
      notified: false
    };

    memory.reminders.push(reminder);

    await fetch(`${API}/api/user/memory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, memory })
    });

    return { success: true, reminder };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Get pending reminders
 */
export async function getPendingReminders() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const res = await fetch(`${API}/api/user/memory?userId=${user.id}`);
    const data = await res.json();
    const reminders = data.memory?.reminders || [];

    return reminders
      .filter(r => !r.notified)
      .sort((a, b) => new Date(a.time) - new Date(b.time));
  } catch (err) {
    console.error('[Proactive] Error getting reminders:', err);
    return [];
  }
}

export default {
  initProactiveReminders,
  startProactiveReminders,
  stopProactiveReminders,
  requestNotificationPermission,
  addQuickReminder,
  getPendingReminders
};
