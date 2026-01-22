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
  
  // Regular phone call - More flexible to handle missed words
  const callMatch = text.match(/\b(?:call|phone|dial|ring|contact)\s*(?:me\s*)?(?:at\s*)?([+]?[\d\s\-\(\)]{7,})/i);
  if (callMatch) {
    const phoneNumber = callMatch[1].replace(/\D/g, ''); // Remove non-digits
    if (phoneNumber.length >= 10) {
      return { type: ActionTypes.MAKE_CALL, params: { number: phoneNumber } };
    }
  }
  
  // Send text/SMS - More flexible
  const textMatch = text.match(/\b(?:text|message|sms|send)\s*(?:me\s*)?(?:a\s*)?(?:message\s*)?(?:to\s*)?([+]?[\d\s\-\(\)]{7,})/i);
  if (textMatch) {
    const phoneNumber = textMatch[1].replace(/\D/g, '');
    if (phoneNumber.length >= 10) {
      // Extract message content (everything after the phone number)
      const messageMatch = text.match(new RegExp(`(?:text|message|sms|send).*?${textMatch[1]}\\s+(.+)$`, 'i'));
      const message = messageMatch ? messageMatch[1] : '';
      return { type: ActionTypes.SEND_TEXT, params: { number: phoneNumber, message } };
    }
  }
  
  // Show on map / get location - More flexible patterns to handle missed words
  // Match: "show map", "show me map", "show on map", "map", "location", "where am i", etc.
  if (/\b(?:show|display|find|open|see|get|my|the)\s*(?:me\s*)?(?:on\s*)?(?:the\s*)?(?:map|location)\b/i.test(text) ||
      /\b(?:map|location)\b/i.test(text) ||
      /\b(?:where|where's|where\s+am|where\s+is)\s*(?:am\s*)?(?:i\s*)?(?:located|at|now|here)\b/i.test(text) ||
      /\b(?:show|display|find)\s*(?:my|me|current)\s*(?:location|position|where)\b/i.test(text)) {
    return { type: ActionTypes.SHOW_MAP, params: {} };
  }
  
  // Set alarm - More flexible
  const alarmMatch = text.match(/\b(?:set|create|schedule|add)\s*(?:an?\s*)?(?:alarm|reminder|timer)\s*(?:for\s*)?(?:at\s*)?([\d:]+(?:\s*(?:am|pm))?)/i);
  if (alarmMatch) {
    const timeStr = alarmMatch[1];
    return { type: ActionTypes.SET_ALARM, params: { time: timeStr } };
  }
  
  // Check calendar - More flexible
  if (/\b(?:check|show|what|view|see|open|my)\s*(?:my\s*)?(?:calendar|schedule|events|appointments)\b/i.test(text) ||
      /\b(?:calendar|schedule)\b/i.test(text)) {
    return { type: ActionTypes.CHECK_CALENDAR, params: {} };
  }
  
  // Add calendar event - More flexible
  const eventMatch = text.match(/\b(?:add|create|schedule|set)\s*(?:an?\s*)?(?:event|appointment|meeting)\s*(?:for\s*)?(.+)/i);
  if (eventMatch) {
    return { type: ActionTypes.ADD_EVENT, params: { description: eventMatch[1] } };
  }
  
  return null;
}

/**
 * Execute device action
 * Uses native Capacitor APIs when available, falls back to web APIs
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
        // Try native first, fallback to web
        try {
          const { getLocationNative, isNativePlatform } = await import('./deviceActionsNative.js');
          const isNative = await isNativePlatform();
          if (isNative) {
            const nativeResult = await getLocationNative();
            if (nativeResult) return nativeResult;
          }
        } catch (err) {
          console.log('Native location not available, using web fallback');
        }
        return await getLocation();
      
      case ActionTypes.SET_ALARM:
        // Try native first, fallback to web
        try {
          const { setAlarmNative, isNativePlatform } = await import('./deviceActionsNative.js');
          const isNative = await isNativePlatform();
          if (isNative) {
            const nativeResult = await setAlarmNative(action.params.time, `Alarm: ${action.params.time}`);
            if (nativeResult) return nativeResult;
          }
        } catch (err) {
          console.log('Native alarm not available, using web fallback');
        }
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
    // Check if we're on a device that supports tel: protocol
    if (!/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
      return { 
        success: false, 
        error: 'Phone calls are only supported on mobile devices. Please use your phone to call 911.' 
      };
    }
    
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
    return { 
      success: false, 
      error: 'Failed to initiate emergency call. Please dial 911 directly on your phone.' 
    };
  }
}

/**
 * Make regular phone call
 * Note: Web apps cannot access device contact list for security reasons.
 * Users must provide phone numbers directly or use their device's dialer app.
 */
async function makeCall(phoneNumber) {
  try {
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    if (cleanNumber.length < 10) {
      return { success: false, error: 'Invalid phone number. Please provide a valid 10-digit phone number.' };
    }
    
    const telUrl = `tel:${cleanNumber}`;
    
    // For iOS, we MUST use a link click from user interaction
    // Create link and trigger immediately (we're in a user interaction context)
    const link = document.createElement('a');
    link.href = telUrl;
    link.style.display = 'none';
    document.body.appendChild(link);
    
    // Trigger immediately - we're in a click handler context
    link.click();
    
    // Clean up after a moment
    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
    }, 100);
    
    return { 
      success: true, 
      message: `Calling ${formatPhoneNumber(cleanNumber)}...`,
      action: 'call_initiated'
    };
  } catch (err) {
    console.error('Call error:', err);
    return { success: false, error: 'Failed to initiate call. Please dial manually.' };
  }
}

/**
 * Send SMS/text message
 */
async function sendText(phoneNumber, message = '') {
  try {
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    if (cleanNumber.length < 10) {
      return { success: false, error: 'Invalid phone number. Please provide a valid 10-digit phone number.' };
    }
    
    // Use sms: protocol (works on mobile devices)
    const smsUrl = message 
      ? `sms:${cleanNumber}?body=${encodeURIComponent(message)}`
      : `sms:${cleanNumber}`;
    
    // Use link click for iOS compatibility
    const link = document.createElement('a');
    link.href = smsUrl;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    
    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
    }, 100);
    
    return { 
      success: true, 
      message: `Opening text message to ${formatPhoneNumber(cleanNumber)}...`,
      action: 'sms_opened'
    };
  } catch (err) {
    console.error('SMS error:', err);
    return { 
      success: false, 
      error: 'Failed to open SMS. Please use your phone to send text messages.' 
    };
  }
}

/**
 * Request geolocation permission
 */
async function requestGeolocationPermission() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ 
        granted: false, 
        error: 'Geolocation is not supported by your browser' 
      });
      return;
    }
    
    // Don't check permission separately - just try to get location directly
    // The browser will prompt for permission automatically
    resolve({ granted: true }); // Assume we can request it
  });
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
    
    console.log('Requesting location...');
    
    // iOS Chrome/Safari needs longer timeout and different settings
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const timeout = isIOS ? 30000 : 15000; // 30s for iOS, 15s for others
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        console.log('Location obtained:', position.coords);
        const { latitude, longitude } = position.coords;
        
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
        
        // Show inline map instead of navigating away
        const { showInlineMap } = await import('../components/actionModal.js');
        showInlineMap(latitude, longitude);
        
        resolve({
          success: true,
          message: `Showing your location on map: ${address}`,
          location: { latitude, longitude, address },
          action: 'location_shared'
        });
      },
      (error) => {
        console.error('Geolocation error:', error);
        let errorMsg = 'Failed to get location';
        if (error.code === error.PERMISSION_DENIED) {
          errorMsg = 'Location permission denied. Go to Settings > Chrome > Location Services and enable it, then try again.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMsg = 'Location unavailable. Please check your device location settings.';
        } else if (error.code === error.TIMEOUT) {
          errorMsg = 'Location request timed out. Please ensure location services are enabled and try again.';
        } else {
          errorMsg = `Location error: ${error.message || 'Unknown error'}`;
        }
        resolve({
          success: false,
          error: errorMsg
        });
      },
      { 
        enableHighAccuracy: false, // false works better on iOS
        timeout: timeout, 
        maximumAge: 300000 // Allow cached position up to 5 minutes old
      }
    );
  });
}

/**
 * Request notification permission
 */
async function requestNotificationPermissionForAlarm() {
  if (!('Notification' in window)) {
    return { 
      granted: false, 
      error: 'Notifications are not supported by your browser' 
    };
  }
  
  if (Notification.permission === 'granted') {
    return { granted: true };
  }
  
  if (Notification.permission === 'denied') {
    return { 
      granted: false, 
      error: 'Notification permission denied. Please enable notifications in your browser settings to receive alarm alerts.' 
    };
  }
  
  // Request permission
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      return { granted: true };
    } else {
      return { 
        granted: false, 
        error: 'Notification permission denied. Alarms will be saved but you won\'t receive alerts.' 
      };
    }
  } catch (err) {
    return { 
      granted: false, 
      error: `Failed to request notification permission: ${err.message}` 
    };
  }
}

/**
 * Set alarm/reminder
 */
async function setAlarm(timeStr) {
  try {
    const time = parseTimeString(timeStr);
    if (!time) {
      return { success: false, error: 'Could not parse time. Please specify time like "3:30 PM" or "15:30"' };
    }
    
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    
    // On iOS web, we CANNOT access the Clock app directly
    // This is an iOS security restriction
    if (isIOS && !window.Capacitor) {
      // Save alarm info and provide instructions
      const alarms = JSON.parse(localStorage.getItem('alarms') || '[]');
      const alarm = {
        id: Date.now(),
        time: time.toISOString(),
        timeStr: timeStr,
        createdAt: new Date().toISOString()
      };
      alarms.push(alarm);
      localStorage.setItem('alarms', JSON.stringify(alarms));
      
      return {
        success: true,
        message: `Alarm saved for ${time.toLocaleTimeString()}. To set it on your device, open the Clock app and set an alarm for this time. Web apps cannot access the Clock app on iOS for security reasons.`,
        alarm: alarm,
        action: 'alarm_saved'
      };
    }
    
    // For Android or native apps, try notifications
    const notificationPermission = await requestNotificationPermissionForAlarm();
    const hasNotificationPermission = notificationPermission.granted;
    
    const alarms = JSON.parse(localStorage.getItem('alarms') || '[]');
    const alarm = {
      id: Date.now(),
      time: time.toISOString(),
      timeStr: timeStr,
      createdAt: new Date().toISOString()
    };
    alarms.push(alarm);
    localStorage.setItem('alarms', JSON.stringify(alarms));
    
    if (hasNotificationPermission) {
      scheduleNotification(time, `Alarm: ${timeStr}`);
    }
    
    let message = `Alarm set for ${time.toLocaleTimeString()}`;
    if (!hasNotificationPermission) {
      message += '. Note: Notification permission is required for alerts.';
    }
    
    return {
      success: true,
      message: message,
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
/**
 * Request notification permission (general)
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.warn('Notifications are not supported by your browser');
    return false;
  }
  
  if (Notification.permission === 'granted') {
    return true;
  }
  
  if (Notification.permission === 'denied') {
    console.warn('Notification permission was previously denied');
    return false;
  }
  
  // Request permission
  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (err) {
    console.error('Failed to request notification permission:', err);
    return false;
  }
}
