/**
 * Tool Executor
 * Implements the actual functionality for each tool
 */

import { supabase } from '../supabase.js';
import { hasCapability, detectCapabilities } from './capabilities.js';

// All Capacitor plugins are loaded dynamically to avoid breaking web builds
let Geolocation = null;
let LocalNotifications = null;
let Filesystem = null;
let Directory = null;
let Encoding = null;
let Calendar = null;
let Contacts = null;

// Check if we're in a Capacitor native environment
function isNative() {
  return typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform();
}

async function loadGeolocationPlugin() {
  if (Geolocation) return Geolocation;
  try {
    const module = await import('https://cdn.jsdelivr.net/npm/@capacitor/geolocation@5/dist/esm/index.js');
    Geolocation = module.Geolocation;
    return Geolocation;
  } catch (e) {
    console.warn('Geolocation plugin not available:', e);
    return null;
  }
}

async function loadNotificationsPlugin() {
  if (LocalNotifications) return LocalNotifications;
  try {
    const module = await import('https://cdn.jsdelivr.net/npm/@capacitor/local-notifications@5/dist/esm/index.js');
    LocalNotifications = module.LocalNotifications;
    return LocalNotifications;
  } catch (e) {
    console.warn('LocalNotifications plugin not available:', e);
    return null;
  }
}

async function loadFilesystemPlugin() {
  if (Filesystem) return { Filesystem, Directory, Encoding };
  try {
    const module = await import('https://cdn.jsdelivr.net/npm/@capacitor/filesystem@5/dist/esm/index.js');
    Filesystem = module.Filesystem;
    Directory = module.Directory;
    Encoding = module.Encoding;
    return { Filesystem, Directory, Encoding };
  } catch (e) {
    console.warn('Filesystem plugin not available:', e);
    return { Filesystem: null, Directory: null, Encoding: null };
  }
}

async function loadCalendarPlugin() {
  if (Calendar) return Calendar;
  try {
    const module = await import('https://cdn.jsdelivr.net/npm/@ebarooni/capacitor-calendar/dist/esm/index.js');
    Calendar = module.Calendar;
    return Calendar;
  } catch (e) {
    console.warn('Calendar plugin not available:', e);
    return null;
  }
}

async function loadContactsPlugin() {
  if (Contacts) return Contacts;
  try {
    const module = await import('https://cdn.jsdelivr.net/npm/@capgo/capacitor-contacts/dist/esm/index.js');
    Contacts = module.Contacts;
    return Contacts;
  } catch (e) {
    console.warn('Contacts plugin not available:', e);
    return null;
  }
}

const API = "https://aibackend-production-a44f.up.railway.app";

// ============ HELPER FUNCTIONS ============

async function getUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id;
}

async function getUserMemoryData() {
  const userId = await getUserId();
  if (!userId) return {};

  const res = await fetch(`${API}/api/user/memory?userId=${userId}`);
  if (!res.ok) return {};

  const data = await res.json();
  return data.memory || {};
}

async function saveUserMemoryData(memory) {
  const userId = await getUserId();
  if (!userId) return false;

  const res = await fetch(`${API}/api/user/memory`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, memory })
  });

  return res.ok;
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// ============ MEMORY TOOLS ============

export async function executeRememberFact({ fact, category = 'other' }) {
  try {
    const memory = await getUserMemoryData();

    if (!memory.structuredFacts) {
      memory.structuredFacts = [];
    }

    // Check for duplicates
    const exists = memory.structuredFacts.some(f =>
      f.fact.toLowerCase() === fact.toLowerCase()
    );

    if (exists) {
      return {
        success: true,
        message: "I already have that noted!"
      };
    }

    memory.structuredFacts.push({
      id: generateId(),
      fact,
      category,
      createdAt: new Date().toISOString()
    });

    await saveUserMemoryData(memory);

    return {
      success: true,
      message: `Got it! I'll remember that.`
    };
  } catch (err) {
    console.error('executeRememberFact error:', err);
    return { success: false, error: err.message };
  }
}

export async function executeRecallFacts({ category = 'all' }) {
  try {
    const memory = await getUserMemoryData();
    let facts = memory.structuredFacts || [];

    // Also include legacy facts array
    if (memory.facts && memory.facts.length > 0) {
      const legacyFacts = memory.facts.map(f => ({
        fact: f,
        category: 'other',
        createdAt: null
      }));
      facts = [...facts, ...legacyFacts];
    }

    if (category !== 'all') {
      facts = facts.filter(f => f.category === category);
    }

    return {
      success: true,
      facts: facts,
      count: facts.length
    };
  } catch (err) {
    console.error('executeRecallFacts error:', err);
    return { success: false, error: err.message };
  }
}

// ============ GOALS TOOLS ============

export async function executeCreateGoal({ title, description, target_date }) {
  try {
    const memory = await getUserMemoryData();

    if (!memory.structuredGoals) {
      memory.structuredGoals = [];
    }

    const goal = {
      id: generateId(),
      title,
      description: description || '',
      targetDate: target_date || null,
      status: 'active',
      progress: [],
      createdAt: new Date().toISOString()
    };

    memory.structuredGoals.push(goal);
    await saveUserMemoryData(memory);

    return {
      success: true,
      goal,
      message: `Great! I've created your goal: "${title}". I'll help you track your progress!`
    };
  } catch (err) {
    console.error('executeCreateGoal error:', err);
    return { success: false, error: err.message };
  }
}

export async function executeUpdateGoal({ goal_id, status, progress_note }) {
  try {
    const memory = await getUserMemoryData();

    if (!memory.structuredGoals) {
      return { success: false, error: 'No goals found' };
    }

    const goalIndex = memory.structuredGoals.findIndex(g => g.id === goal_id);
    if (goalIndex === -1) {
      return { success: false, error: 'Goal not found' };
    }

    const goal = memory.structuredGoals[goalIndex];

    if (status) {
      goal.status = status;
      if (status === 'completed') {
        goal.completedAt = new Date().toISOString();
      }
    }

    if (progress_note) {
      if (!goal.progress) goal.progress = [];
      goal.progress.push({
        note: progress_note,
        date: new Date().toISOString()
      });
    }

    memory.structuredGoals[goalIndex] = goal;
    await saveUserMemoryData(memory);

    const message = status === 'completed'
      ? `Congratulations! You've completed "${goal.title}"! That's amazing!`
      : `Updated your goal "${goal.title}".`;

    return {
      success: true,
      goal,
      message
    };
  } catch (err) {
    console.error('executeUpdateGoal error:', err);
    return { success: false, error: err.message };
  }
}

export async function executeGetGoals({ status = 'all' }) {
  try {
    const memory = await getUserMemoryData();
    let goals = memory.structuredGoals || [];

    // Also include legacy goals
    if (memory.goals && memory.goals.length > 0) {
      const legacyGoals = memory.goals.map(g => ({
        id: generateId(),
        title: g.text,
        status: g.status || 'active',
        createdAt: g.createdAt
      }));
      goals = [...goals, ...legacyGoals];
    }

    if (status !== 'all') {
      goals = goals.filter(g => g.status === status);
    }

    return {
      success: true,
      goals,
      count: goals.length
    };
  } catch (err) {
    console.error('executeGetGoals error:', err);
    return { success: false, error: err.message };
  }
}

// ============ HABITS TOOLS ============

export async function executeCreateHabit({ title, frequency = 'daily', reminder_time }) {
  try {
    const memory = await getUserMemoryData();

    if (!memory.structuredHabits) {
      memory.structuredHabits = [];
    }

    const habit = {
      id: generateId(),
      title,
      frequency,
      reminderTime: reminder_time || null,
      streak: 0,
      longestStreak: 0,
      completions: [],
      createdAt: new Date().toISOString()
    };

    memory.structuredHabits.push(habit);
    await saveUserMemoryData(memory);

    return {
      success: true,
      habit,
      message: `I've created your "${title}" habit. Let's build that streak!`
    };
  } catch (err) {
    console.error('executeCreateHabit error:', err);
    return { success: false, error: err.message };
  }
}

export async function executeLogHabit({ habit_id, completed, note }) {
  try {
    const memory = await getUserMemoryData();

    if (!memory.structuredHabits) {
      return { success: false, error: 'No habits found' };
    }

    const habitIndex = memory.structuredHabits.findIndex(h => h.id === habit_id);
    if (habitIndex === -1) {
      return { success: false, error: 'Habit not found' };
    }

    const habit = memory.structuredHabits[habitIndex];
    const today = new Date().toISOString().split('T')[0];

    // Check if already logged today
    const alreadyLogged = habit.completions?.some(c =>
      c.date.startsWith(today)
    );

    if (alreadyLogged) {
      return {
        success: true,
        message: `You've already logged "${habit.title}" for today!`,
        habit
      };
    }

    // Log completion
    if (!habit.completions) habit.completions = [];
    habit.completions.push({
      date: new Date().toISOString(),
      completed,
      note: note || null
    });

    // Update streak
    if (completed) {
      habit.streak = (habit.streak || 0) + 1;
      if (habit.streak > (habit.longestStreak || 0)) {
        habit.longestStreak = habit.streak;
      }
    } else {
      habit.streak = 0;
    }

    habit.lastCompleted = completed ? new Date().toISOString() : habit.lastCompleted;

    memory.structuredHabits[habitIndex] = habit;
    await saveUserMemoryData(memory);

    let message = completed
      ? `Nice! "${habit.title}" logged. You're on a ${habit.streak}-day streak!`
      : `Logged "${habit.title}" as skipped. Tomorrow is a new day!`;

    // Celebrate milestones
    if (habit.streak === 7) message += " That's a whole week!";
    if (habit.streak === 30) message += " A whole month! You're crushing it!";
    if (habit.streak === 100) message += " 100 DAYS! You're a legend!";

    return {
      success: true,
      habit,
      message
    };
  } catch (err) {
    console.error('executeLogHabit error:', err);
    return { success: false, error: err.message };
  }
}

export async function executeGetHabits() {
  try {
    const memory = await getUserMemoryData();
    let habits = memory.structuredHabits || [];

    // Also include legacy habits
    if (memory.habits && memory.habits.length > 0) {
      const legacyHabits = memory.habits.map(h => ({
        id: generateId(),
        title: h.text,
        streak: h.streak || 0,
        createdAt: h.createdAt
      }));
      habits = [...habits, ...legacyHabits];
    }

    return {
      success: true,
      habits,
      count: habits.length
    };
  } catch (err) {
    console.error('executeGetHabits error:', err);
    return { success: false, error: err.message };
  }
}

// ============ REMINDERS & TIMERS ============

// Active timers (in-memory, lost on refresh - would need service worker for persistence)
const activeTimers = new Map();
const activeReminders = new Map();

export async function executeSetReminder({ message, time }) {
  try {
    const reminderTime = parseTime(time);
    if (!reminderTime) {
      return { success: false, error: 'Could not parse time' };
    }

    const now = Date.now();
    const delay = reminderTime.getTime() - now;

    if (delay <= 0) {
      return { success: false, error: 'Time must be in the future' };
    }

    const id = generateId();

    // Try native notifications first (Capacitor)
    const caps = await detectCapabilities();
    if (caps.nativeNotifications) {
      try {
        const notifications = await loadNotificationsPlugin();
        if (notifications) {
          await notifications.schedule({
            notifications: [{
              id: parseInt(id.slice(-8), 36) % 2147483647, // Convert to valid int32
              title: 'Reminder',
              body: message,
              schedule: { at: reminderTime },
              sound: 'default'
            }]
          });
        }
      } catch (e) {
        console.warn('Native notification failed, using fallback:', e);
      }
    }

    // Also set JS timer as backup / for web
    const timerId = setTimeout(async () => {
      // Show notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Reminder', { body: message });
      }

      // Also trigger in-app notification
      window.dispatchEvent(new CustomEvent('pal-reminder', {
        detail: { message, id }
      }));

      activeReminders.delete(id);
    }, delay);

    activeReminders.set(id, { timerId, message, time: reminderTime });

    const timeStr = reminderTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });

    return {
      success: true,
      id,
      message: `I'll remind you "${message}" at ${timeStr}`
    };
  } catch (err) {
    console.error('executeSetReminder error:', err);
    return { success: false, error: err.message };
  }
}

export async function executeSetTimer({ duration, label }) {
  try {
    const ms = parseDuration(duration);
    if (!ms || ms <= 0) {
      return { success: false, error: 'Could not parse duration' };
    }

    const id = generateId();
    const endTime = new Date(Date.now() + ms);

    const timerId = setTimeout(async () => {
      // Alert user
      const caps = await detectCapabilities();

      if (caps.nativeNotifications) {
        try {
          const notifications = await loadNotificationsPlugin();
          if (notifications) {
            await notifications.schedule({
              notifications: [{
                id: parseInt(id.slice(-8), 36) % 2147483647,
                title: 'Timer Complete',
                body: label || 'Your timer has finished!',
                sound: 'default'
              }]
            });
          }
        } catch (e) {
          console.warn('Native notification failed:', e);
        }
      }

      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Timer Complete', {
          body: label || 'Your timer has finished!'
        });
      }

      // In-app event
      window.dispatchEvent(new CustomEvent('pal-timer', {
        detail: { label, id }
      }));

      activeTimers.delete(id);
    }, ms);

    activeTimers.set(id, { timerId, label, endTime });

    return {
      success: true,
      id,
      duration: ms,
      message: `Timer set for ${duration}${label ? ` (${label})` : ''}`
    };
  } catch (err) {
    console.error('executeSetTimer error:', err);
    return { success: false, error: err.message };
  }
}

// ============ INFORMATION TOOLS ============

export async function executeWebSearch({ query }) {
  try {
    // Use backend search endpoint (you'll need to implement this)
    const res = await fetch(`${API}/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });

    if (!res.ok) {
      // Fallback: return a message to search manually
      return {
        success: true,
        results: [],
        message: `I couldn't search the web right now. You can search for "${query}" manually.`,
        fallback: true
      };
    }

    const data = await res.json();
    return {
      success: true,
      results: data.results || [],
      message: `Found ${data.results?.length || 0} results for "${query}"`
    };
  } catch (err) {
    console.error('executeWebSearch error:', err);
    return {
      success: true,
      results: [],
      message: `Search is not available right now. Try searching for "${query}" manually.`,
      fallback: true
    };
  }
}

export async function executeGetWeather({ location }) {
  try {
    let lat, lon;

    if (location === 'current') {
      // Get device location
      const position = await getCurrentPosition();
      if (!position) {
        return { success: false, error: 'Could not get location' };
      }
      lat = position.coords.latitude;
      lon = position.coords.longitude;
    } else {
      // Geocode the location (simplified - you'd want a real geocoding API)
      // For now, use backend
      const geoRes = await fetch(`${API}/api/geocode?location=${encodeURIComponent(location)}`);
      if (geoRes.ok) {
        const geo = await geoRes.json();
        lat = geo.lat;
        lon = geo.lon;
      }
    }

    // Fetch weather (using Open-Meteo free API)
    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weathercode,windspeed_10m&temperature_unit=fahrenheit`
    );

    if (!weatherRes.ok) {
      return { success: false, error: 'Weather service unavailable' };
    }

    const weather = await weatherRes.json();
    const current = weather.current;

    return {
      success: true,
      temperature: Math.round(current.temperature_2m),
      unit: '°F',
      condition: getWeatherCondition(current.weathercode),
      windSpeed: Math.round(current.windspeed_10m),
      location: location === 'current' ? 'your location' : location
    };
  } catch (err) {
    console.error('executeGetWeather error:', err);
    return { success: false, error: err.message };
  }
}

export async function executeGetDateTime({ timezone = 'local', format = 'full' }) {
  try {
    const now = new Date();
    const options = {
      timeZone: timezone === 'local' ? undefined : timezone
    };

    let result = {};

    if (format === 'full' || format === 'date') {
      result.date = now.toLocaleDateString('en-US', {
        ...options,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }

    if (format === 'full' || format === 'time') {
      result.time = now.toLocaleTimeString('en-US', {
        ...options,
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit'
      });
    }

    result.timestamp = now.toISOString();
    result.timezone = timezone === 'local' ? Intl.DateTimeFormat().resolvedOptions().timeZone : timezone;

    return {
      success: true,
      ...result
    };
  } catch (err) {
    console.error('executeGetDateTime error:', err);
    return { success: false, error: err.message };
  }
}

export async function executeCalculate({ expression }) {
  try {
    // Safe math evaluation
    const result = evaluateMath(expression);

    return {
      success: true,
      expression,
      result,
      formatted: typeof result === 'number' ? result.toLocaleString() : result
    };
  } catch (err) {
    console.error('executeCalculate error:', err);
    return { success: false, error: `Could not calculate: ${err.message}` };
  }
}

// ============ DEVICE TOOLS ============

export async function executeGetLocation({ precision = 'low' }) {
  try {
    const position = await getCurrentPosition(precision === 'high');

    if (!position) {
      return { success: false, error: 'Could not get location' };
    }

    return {
      success: true,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy
    };
  } catch (err) {
    console.error('executeGetLocation error:', err);
    return { success: false, error: err.message };
  }
}

export async function executeSendNotification({ title, body }) {
  try {
    const caps = await detectCapabilities();

    if (caps.nativeNotifications) {
      const notifications = await loadNotificationsPlugin();
      if (notifications) {
        await notifications.schedule({
          notifications: [{
            id: Math.floor(Math.random() * 2147483647),
            title,
            body,
            sound: 'default'
          }]
        });
        return { success: true, message: 'Notification sent' };
      }
    }

    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(title, { body });
        return { success: true, message: 'Notification sent' };
      } else if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          new Notification(title, { body });
          return { success: true, message: 'Notification sent' };
        }
      }
    }

    return { success: false, error: 'Notifications not available' };
  } catch (err) {
    console.error('executeSendNotification error:', err);
    return { success: false, error: err.message };
  }
}

export async function executeCopyToClipboard({ text }) {
  try {
    await navigator.clipboard.writeText(text);
    return {
      success: true,
      message: 'Copied to clipboard!'
    };
  } catch (err) {
    console.error('executeCopyToClipboard error:', err);
    return { success: false, error: 'Could not copy to clipboard' };
  }
}

// ============ HELPER IMPLEMENTATIONS ============

async function getCurrentPosition(highAccuracy = false) {
  const caps = await detectCapabilities();

  if (caps.nativeGeolocation) {
    try {
      const geo = await loadGeolocationPlugin();
      if (geo) {
        const position = await geo.getCurrentPosition({
          enableHighAccuracy: highAccuracy
        });
        return position;
      }
    } catch (e) {
      console.warn('Native geolocation failed:', e);
    }
  }

  // Fallback to web API
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      () => resolve(null),
      { enableHighAccuracy: highAccuracy, timeout: 10000 }
    );
  });
}

function parseTime(timeStr) {
  const now = new Date();

  // Handle relative times
  const relativeMatch = timeStr.match(/in\s+(\d+)\s*(minute|min|hour|hr|second|sec)s?/i);
  if (relativeMatch) {
    const amount = parseInt(relativeMatch[1]);
    const unit = relativeMatch[2].toLowerCase();

    const ms = unit.startsWith('hour') || unit.startsWith('hr') ? amount * 60 * 60 * 1000 :
      unit.startsWith('min') ? amount * 60 * 1000 :
        amount * 1000;

    return new Date(now.getTime() + ms);
  }

  // Handle "tomorrow at X"
  const tomorrowMatch = timeStr.match(/tomorrow\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (tomorrowMatch) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let hours = parseInt(tomorrowMatch[1]);
    const minutes = tomorrowMatch[2] ? parseInt(tomorrowMatch[2]) : 0;
    const ampm = tomorrowMatch[3]?.toLowerCase();

    if (ampm === 'pm' && hours < 12) hours += 12;
    if (ampm === 'am' && hours === 12) hours = 0;

    tomorrow.setHours(hours, minutes, 0, 0);
    return tomorrow;
  }

  // Handle "at X" (today)
  const atMatch = timeStr.match(/(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (atMatch) {
    const result = new Date(now);

    let hours = parseInt(atMatch[1]);
    const minutes = atMatch[2] ? parseInt(atMatch[2]) : 0;
    const ampm = atMatch[3]?.toLowerCase();

    if (ampm === 'pm' && hours < 12) hours += 12;
    if (ampm === 'am' && hours === 12) hours = 0;

    result.setHours(hours, minutes, 0, 0);

    // If time has passed today, assume tomorrow
    if (result <= now) {
      result.setDate(result.getDate() + 1);
    }

    return result;
  }

  // Try ISO format
  const parsed = new Date(timeStr);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  return null;
}

function parseDuration(durationStr) {
  let totalMs = 0;

  // Match hours
  const hourMatch = durationStr.match(/(\d+)\s*(?:hour|hr)s?/i);
  if (hourMatch) {
    totalMs += parseInt(hourMatch[1]) * 60 * 60 * 1000;
  }

  // Match minutes
  const minMatch = durationStr.match(/(\d+)\s*(?:minute|min)s?/i);
  if (minMatch) {
    totalMs += parseInt(minMatch[1]) * 60 * 1000;
  }

  // Match seconds
  const secMatch = durationStr.match(/(\d+)\s*(?:second|sec)s?/i);
  if (secMatch) {
    totalMs += parseInt(secMatch[1]) * 1000;
  }

  // If just a number, assume minutes
  if (totalMs === 0) {
    const justNumber = durationStr.match(/^(\d+)$/);
    if (justNumber) {
      totalMs = parseInt(justNumber[1]) * 60 * 1000;
    }
  }

  return totalMs;
}

function getWeatherCondition(code) {
  const conditions = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Foggy',
    48: 'Depositing rime fog',
    51: 'Light drizzle',
    53: 'Moderate drizzle',
    55: 'Dense drizzle',
    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    71: 'Slight snow',
    73: 'Moderate snow',
    75: 'Heavy snow',
    77: 'Snow grains',
    80: 'Slight rain showers',
    81: 'Moderate rain showers',
    82: 'Violent rain showers',
    85: 'Slight snow showers',
    86: 'Heavy snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with slight hail',
    99: 'Thunderstorm with heavy hail'
  };
  return conditions[code] || 'Unknown';
}

function evaluateMath(expression) {
  // Handle common patterns
  let expr = expression.toLowerCase()
    .replace(/percent of/gi, '* 0.01 *')
    .replace(/(\d+)%\s*of\s*(\d+)/gi, '$1 * 0.01 * $2')
    .replace(/(\d+)%/gi, '$1 * 0.01')
    .replace(/sqrt\(([^)]+)\)/gi, 'Math.sqrt($1)')
    .replace(/(\d+)\^(\d+)/g, 'Math.pow($1,$2)')
    .replace(/pi/gi, 'Math.PI')
    .replace(/sin\(/gi, 'Math.sin(')
    .replace(/cos\(/gi, 'Math.cos(')
    .replace(/tan\(/gi, 'Math.tan(')
    .replace(/log\(/gi, 'Math.log10(')
    .replace(/ln\(/gi, 'Math.log(')
    .replace(/abs\(/gi, 'Math.abs(');

  // Security: only allow math characters
  if (!/^[\d\s+\-*/().Math,powsqrtsincogtanlogabPI]+$/i.test(expr)) {
    throw new Error('Invalid expression');
  }

  // Evaluate
  const result = Function(`"use strict"; return (${expr})`)();

  if (typeof result !== 'number' || !isFinite(result)) {
    throw new Error('Result is not a valid number');
  }

  return result;
}

// ============ CALENDAR TOOLS ============

export async function executeCreateCalendarEvent({ title, start_time, end_time, location, notes }) {
  try {
    const caps = await detectCapabilities();

    if (!caps.isNative) {
      return {
        success: false,
        error: 'Calendar access requires the native app. This feature is not available in the browser.'
      };
    }

    const CalendarPlugin = await loadCalendarPlugin();
    if (!CalendarPlugin) {
      return { success: false, error: 'Calendar plugin not available' };
    }

    // Parse start time
    const startDate = parseTime(start_time);
    if (!startDate) {
      return { success: false, error: 'Could not parse start time' };
    }

    // Parse end time or default to 1 hour after start
    let endDate;
    if (end_time) {
      endDate = parseTime(end_time);
    }
    if (!endDate) {
      endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour later
    }

    // Request calendar permission
    const permResult = await CalendarPlugin.requestWriteOnlyCalendarAccess();
    if (permResult.result !== 'granted') {
      return { success: false, error: 'Calendar permission denied' };
    }

    // Create the event
    const result = await CalendarPlugin.createEvent({
      title,
      startDate: startDate.getTime(),
      endDate: endDate.getTime(),
      location: location || undefined,
      notes: notes || undefined
    });

    return {
      success: true,
      eventId: result.id,
      message: `Created event "${title}" for ${startDate.toLocaleString()}`
    };
  } catch (err) {
    console.error('executeCreateCalendarEvent error:', err);
    return { success: false, error: err.message };
  }
}

export async function executeGetCalendarEvents({ days_ahead = 7 }) {
  try {
    const caps = await detectCapabilities();

    if (!caps.isNative) {
      return {
        success: false,
        error: 'Calendar access requires the native app.'
      };
    }

    const CalendarPlugin = await loadCalendarPlugin();
    if (!CalendarPlugin) {
      return { success: false, error: 'Calendar plugin not available' };
    }

    // Request calendar permission
    const permResult = await CalendarPlugin.requestReadOnlyCalendarAccess();
    if (permResult.result !== 'granted') {
      return { success: false, error: 'Calendar permission denied' };
    }

    const now = new Date();
    const endDate = new Date(now.getTime() + days_ahead * 24 * 60 * 60 * 1000);

    const result = await CalendarPlugin.listEventsInRange({
      startDate: now.getTime(),
      endDate: endDate.getTime()
    });

    const events = (result.events || []).map(e => ({
      title: e.title,
      start: new Date(e.startDate).toLocaleString(),
      end: new Date(e.endDate).toLocaleString(),
      location: e.location
    }));

    return {
      success: true,
      events,
      count: events.length,
      message: `Found ${events.length} events in the next ${days_ahead} days`
    };
  } catch (err) {
    console.error('executeGetCalendarEvents error:', err);
    return { success: false, error: err.message };
  }
}

// ============ CONTACTS TOOLS ============

export async function executeSearchContacts({ query }) {
  try {
    const caps = await detectCapabilities();

    if (!caps.isNative) {
      return {
        success: false,
        error: 'Contacts access requires the native app.'
      };
    }

    const ContactsPlugin = await loadContactsPlugin();
    if (!ContactsPlugin) {
      return { success: false, error: 'Contacts plugin not available' };
    }

    // Request permission
    const permResult = await ContactsPlugin.requestPermissions();
    if (permResult.contacts !== 'granted') {
      return { success: false, error: 'Contacts permission denied' };
    }

    // Get contacts
    const result = await ContactsPlugin.getContacts({
      projection: {
        name: true,
        phones: true,
        emails: true
      }
    });

    // Filter by query
    const searchLower = query.toLowerCase();
    const matches = (result.contacts || [])
      .filter(c => c.name?.display?.toLowerCase().includes(searchLower))
      .slice(0, 10) // Limit results
      .map(c => ({
        name: c.name?.display,
        phone: c.phones?.[0]?.number,
        email: c.emails?.[0]?.address
      }));

    return {
      success: true,
      contacts: matches,
      count: matches.length,
      message: `Found ${matches.length} contacts matching "${query}"`
    };
  } catch (err) {
    console.error('executeSearchContacts error:', err);
    return { success: false, error: err.message };
  }
}

export async function executeGetContact({ name }) {
  try {
    // Just use search with exact name
    return await executeSearchContacts({ query: name });
  } catch (err) {
    console.error('executeGetContact error:', err);
    return { success: false, error: err.message };
  }
}

// ============ FILE/NOTES TOOLS ============

const NOTES_FOLDER = 'pal_notes';

export async function executeSaveNote({ filename, content }) {
  try {
    const caps = await detectCapabilities();

    // Sanitize filename
    const safeName = filename.replace(/[^a-zA-Z0-9_-]/g, '_') + '.txt';

    if (caps.isNative) {
      // Use Capacitor Filesystem
      const fs = await loadFilesystemPlugin();
      if (fs.Filesystem) {
        await fs.Filesystem.writeFile({
          path: `${NOTES_FOLDER}/${safeName}`,
          data: content,
          directory: fs.Directory.Documents,
          encoding: fs.Encoding.UTF8,
          recursive: true
        });

        return {
          success: true,
          filename: safeName,
          message: `Saved note "${filename}"`
        };
      }
    }

    // Web fallback or native not available
    {
      // Web fallback - use localStorage
      const notes = JSON.parse(localStorage.getItem('pal_notes') || '{}');
      notes[safeName] = {
        content,
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem('pal_notes', JSON.stringify(notes));

      return {
        success: true,
        filename: safeName,
        message: `Saved note "${filename}" (stored locally)`
      };
    }
  } catch (err) {
    console.error('executeSaveNote error:', err);
    return { success: false, error: err.message };
  }
}

export async function executeReadNote({ filename }) {
  try {
    const caps = await detectCapabilities();
    const safeName = filename.endsWith('.txt') ? filename : filename + '.txt';

    if (caps.isNative) {
      const fs = await loadFilesystemPlugin();
      if (fs.Filesystem) {
        const result = await fs.Filesystem.readFile({
          path: `${NOTES_FOLDER}/${safeName}`,
          directory: fs.Directory.Documents,
          encoding: fs.Encoding.UTF8
        });

        return {
          success: true,
          filename: safeName,
          content: result.data
        };
      }
    }

    // Web fallback
    {
      // Web fallback
      const notes = JSON.parse(localStorage.getItem('pal_notes') || '{}');
      const note = notes[safeName];

      if (!note) {
        return { success: false, error: `Note "${filename}" not found` };
      }

      return {
        success: true,
        filename: safeName,
        content: note.content
      };
    }
  } catch (err) {
    console.error('executeReadNote error:', err);
    return { success: false, error: `Could not read note: ${err.message}` };
  }
}

export async function executeListNotes() {
  try {
    const caps = await detectCapabilities();

    if (caps.isNative) {
      try {
        const fs = await loadFilesystemPlugin();
        if (fs.Filesystem) {
          const result = await fs.Filesystem.readdir({
            path: NOTES_FOLDER,
            directory: fs.Directory.Documents
          });

          const notes = result.files
            .filter(f => f.name.endsWith('.txt'))
            .map(f => f.name.replace('.txt', ''));

          return {
            success: true,
            notes,
            count: notes.length
          };
        }
      } catch (e) {
        // Folder might not exist yet
        return {
          success: true,
          notes: [],
          count: 0,
          message: 'No notes saved yet'
        };
      }
    }

    // Web fallback
    {
      // Web fallback
      const notes = JSON.parse(localStorage.getItem('pal_notes') || '{}');
      const noteNames = Object.keys(notes).map(n => n.replace('.txt', ''));

      return {
        success: true,
        notes: noteNames,
        count: noteNames.length
      };
    }
  } catch (err) {
    console.error('executeListNotes error:', err);
    return { success: false, error: err.message };
  }
}
