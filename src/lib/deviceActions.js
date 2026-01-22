/**
 * Device Actions Handler
 * Allows AI to interact with device features like calls, texts, maps, calendar, alarms
 */

/**
 * Action types the AI can request
 */
export const ActionTypes = {
  SHOW_MAP: 'show_map',
  GET_LOCATION: 'get_location',
  MAKE_CALL: 'make_call',
  EMERGENCY_CALL: 'emergency_call',
  SEND_TEXT: 'send_text',
  SET_ALARM: 'set_alarm',
  CHECK_CALENDAR: 'check_calendar',
  ADD_EVENT: 'add_event',
  OPEN_APP: 'open_app'
};

/**
 * Parse AI response for action requests
 * Looks for patterns like "show me on map", "call 911", "set alarm", etc.
 */
export function parseActionRequest(text) {
  const lowerText = text.toLowerCase();
  
  // Emergency call detection (highest priority)
  if (/\b(?:call|dial|phone|contact)\s+(?:9-1-1|911|emergency|emergency services)\b/i.test(text)) {
    return { type: ActionTypes.EMERGENCY_CALL, params: {} };
  }
  
  // Regular phone call
  const callMatch = text.match(/\b(?:call|phone|dial|ring)\s+(?:me\s+)?(?:at\s+)?([+]?[\d\s\-\(\)]{7,})/i);
  if (callMatch) {
    const phoneNumber = callMatch[1].replace(/\D/g, ''); // Remove non-digits
    if (phoneNumber.length >= 10) {
      return { type: ActionTypes.MAKE_CALL, params: { number: phoneNumber } };
    }
  }
  
  // Send text/SMS
  const textMatch = text.match(/\b(?:text|message|sms|send)\s+(?:me\s+)?(?:a\s+)?(?:message\s+)?(?:to\s+)?([+]?[\d\s\-\(\)]{7,})/i);
  if (textMatch) {
    const phoneNumber = textMatch[1].replace(/\D/g, '');
    if (phoneNumber.length >= 10) {
      // Extract message content (everything after the phone number)
      const messageMatch = text.match(new RegExp(`(?:text|message|sms|send).*?${textMatch[1]}\\s+(.+)$`, 'i'));
      const message = messageMatch ? messageMatch[1] : '';
      return { type: ActionTypes.SEND_TEXT, params: { number: phoneNumber, message } };
    }
  }
  
  // Show on map / get location
  if (/\b(?:show|display|find|where|location|map)\s+(?:me\s+)?(?:on\s+)?(?:the\s+)?(?:map|location)\b/i.test(text)) {
    return { type: ActionTypes.SHOW_MAP, params: {} };
  }
  
  if (/\b(?:where\s+)?(?:am\s+)?i\s+(?:located|at|now)\b/i.test(text)) {
    return { type: ActionTypes.GET_LOCATION, params: {} };
  }
  
  // Set alarm
  const alarmMatch = text.match(/\b(?:set|create|schedule)\s+(?:an?\s+)?(?:alarm|reminder|timer)\s+(?:for\s+)?(?:at\s+)?([\d:]+(?:\s*(?:am|pm))?)/i);
  if (alarmMatch) {
    const timeStr = alarmMatch[1];
    return { type: ActionTypes.SET_ALARM, params: { time: timeStr } };
  }
  
  // Check calendar
  if (/\b(?:check|show|what|view|see)\s+(?:my\s+)?(?:calendar|schedule|events|appointments)\b/i.test(text)) {
    return { type: ActionTypes.CHECK_CALENDAR, params: {} };
  }
  
  // Add calendar event
  const eventMatch = text.match(/\b(?:add|create|schedule|set)\s+(?:an?\s+)?(?:event|appointment|meeting)\s+(?:for\s+)?(.+)/i);
  if (eventMatch) {
    return { type: ActionTypes.ADD_EVENT, params: { description: eventMatch[1] } };
  }
  
  return null;
}

/**
 * Execute device action
 */
export async function executeAction(action) {
  if (!action || !action.type) {
    return { success: false, error: 'Invalid action' };
  }
  
  try {
    switch (action.type) {
      case ActionTypes.EMERGENCY_CALL:
        return await makeEmergencyCall();
      
      case ActionTypes.MAKE_CALL:
        return await makeCall(action.params.number);
      
      case ActionTypes.SEND_TEXT:
        return await sendText(action.params.number, action.params.message);
      
      case ActionTypes.SHOW_MAP:
      case ActionTypes.GET_LOCATION:
        return await getLocation();
      
      case ActionTypes.SET_ALARM:
        return await setAlarm(action.params.time);
      
      case ActionTypes.CHECK_CALENDAR:
        return await checkCalendar();
      
      case ActionTypes.ADD_EVENT:
        return await addCalendarEvent(action.params.description);
      
      default:
        return { success: false, error: 'Unknown action type' };
    }
  } catch (err) {
    console.error('Action execution error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Make emergency call (911)
 */
async function makeEmergencyCall() {
  try {
    // Use tel: protocol - open in new window/tab to avoid navigation
    const link = document.createElement('a');
    link.href = 'tel:911';
    link.click();
    
    return { 
      success: true, 
      message: 'Initiating emergency call to 911...',
      action: 'emergency_call_initiated'
    };
  } catch (err) {
    console.error('Emergency call error:', err);
    return { success: false, error: 'Failed to initiate emergency call: ' + err.message };
  }
}

/**
 * Make regular phone call
 */
async function makeCall(phoneNumber) {
  try {
    // Clean phone number
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    if (cleanNumber.length < 10) {
      return { success: false, error: 'Invalid phone number' };
    }
    
    // Use tel: protocol - open in new window/tab to avoid navigation
    const link = document.createElement('a');
    link.href = `tel:${cleanNumber}`;
    link.click();
    
    return { 
      success: true, 
      message: `Calling ${formatPhoneNumber(cleanNumber)}...`,
      action: 'call_initiated'
    };
  } catch (err) {
    console.error('Call error:', err);
    return { success: false, error: 'Failed to initiate call: ' + err.message };
  }
}

/**
 * Send SMS/text message
 */
async function sendText(phoneNumber, message = '') {
  try {
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    if (cleanNumber.length < 10) {
      return { success: false, error: 'Invalid phone number' };
    }
    
    // Use sms: protocol (works on mobile devices)
    const smsUrl = message 
      ? `sms:${cleanNumber}?body=${encodeURIComponent(message)}`
      : `sms:${cleanNumber}`;
    
    // Open in new window/tab to avoid navigation
    const link = document.createElement('a');
    link.href = smsUrl;
    link.click();
    
    return { 
      success: true, 
      message: `Opening text message to ${formatPhoneNumber(cleanNumber)}...`,
      action: 'sms_opened'
    };
  } catch (err) {
    console.error('SMS error:', err);
    return { success: false, error: 'Failed to open SMS: ' + err.message };
  }
}

/**
 * Get current location and show on map
 */
async function getLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ 
        success: false, 
        error: 'Geolocation is not supported by your browser' 
      });
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        // Open in Google Maps
        const mapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
        window.open(mapsUrl, '_blank');
        
        // Try to get address (reverse geocoding)
        let address = 'Current location';
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );
          const data = await response.json();
          if (data.display_name) {
            address = data.display_name;
          }
        } catch (err) {
          console.error('Reverse geocoding failed:', err);
        }
        
        resolve({
          success: true,
          message: `Your location: ${address}`,
          location: { latitude, longitude, address },
          action: 'location_shared'
        });
      },
      (error) => {
        resolve({
          success: false,
          error: `Location access denied: ${error.message}`
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

/**
 * Set alarm/reminder
 */
async function setAlarm(timeStr) {
  try {
    // Parse time string (e.g., "3:30 PM", "15:30", "3pm")
    const time = parseTimeString(timeStr);
    if (!time) {
      return { success: false, error: 'Could not parse time. Please specify time like "3:30 PM" or "15:30"' };
    }
    
    // Store alarm in localStorage (for now - could use Web Notifications API)
    const alarms = JSON.parse(localStorage.getItem('alarms') || '[]');
    const alarm = {
      id: Date.now(),
      time: time.toISOString(),
      timeStr: timeStr,
      createdAt: new Date().toISOString()
    };
    alarms.push(alarm);
    localStorage.setItem('alarms', JSON.stringify(alarms));
    
    // Schedule notification if supported
    if ('Notification' in window && Notification.permission === 'granted') {
      scheduleNotification(time, `Alarm: ${timeStr}`);
    } else if ('Notification' in window && Notification.permission !== 'denied') {
      // Request permission
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          scheduleNotification(time, `Alarm: ${timeStr}`);
        }
      });
    }
    
    return {
      success: true,
      message: `Alarm set for ${time.toLocaleTimeString()}`,
      alarm: alarm,
      action: 'alarm_set'
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Check calendar events
 */
async function checkCalendar() {
  try {
    // Open Google Calendar
    window.open('https://calendar.google.com/calendar/r', '_blank');
    
    return {
      success: true,
      message: 'Opening your calendar...',
      action: 'calendar_opened'
    };
  } catch (err) {
    console.error('Calendar error:', err);
    return { success: false, error: 'Failed to open calendar: ' + err.message };
  }
}

/**
 * Add calendar event
 */
async function addCalendarEvent(description) {
  try {
    // Create calendar event URL (Google Calendar format)
    const event = {
      text: description,
      dates: new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    };
    
    const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.text)}&dates=${event.dates}/${event.dates}`;
    window.open(calendarUrl, '_blank');
    
    return {
      success: true,
      message: `Opening calendar to add: ${description}`,
      action: 'event_added'
    };
  } catch (err) {
    console.error('Calendar event error:', err);
    return { success: false, error: 'Failed to add calendar event: ' + err.message };
  }
}

/**
 * Helper: Format phone number for display
 */
function formatPhoneNumber(number) {
  const cleaned = number.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  } else if (cleaned.length === 11 && cleaned[0] === '1') {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return number;
}

/**
 * Helper: Parse time string to Date object
 */
function parseTimeString(timeStr) {
  const now = new Date();
  const lower = timeStr.toLowerCase().trim();
  
  // Try to parse various formats
  // Format: "3:30 PM", "15:30", "3pm", etc.
  let hours, minutes;
  
  // Check for AM/PM
  const hasAmPm = /(am|pm)/.test(lower);
  const amPmMatch = lower.match(/(am|pm)/);
  const isPM = amPmMatch && amPmMatch[1] === 'pm';
  
  // Extract hours and minutes
  const timeMatch = lower.match(/(\d{1,2}):?(\d{2})?/);
  if (timeMatch) {
    hours = parseInt(timeMatch[1]);
    minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    
    // Convert to 24-hour format if AM/PM specified
    if (hasAmPm) {
      if (isPM && hours !== 12) hours += 12;
      if (!isPM && hours === 12) hours = 0;
    }
    
    const alarmTime = new Date();
    alarmTime.setHours(hours, minutes, 0, 0);
    
    // If time has passed today, set for tomorrow
    if (alarmTime < now) {
      alarmTime.setDate(alarmTime.getDate() + 1);
    }
    
    return alarmTime;
  }
  
  return null;
}

/**
 * Schedule browser notification for alarm
 */
function scheduleNotification(time, message) {
  const now = new Date();
  const delay = time.getTime() - now.getTime();
  
  if (delay > 0) {
    setTimeout(() => {
      new Notification('Alarm', {
        body: message,
        icon: '/favicon.ico',
        requireInteraction: true
      });
    }, delay);
  }
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  return Notification.permission === 'granted';
}
