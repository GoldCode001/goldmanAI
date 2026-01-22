/**
 * Native Device Actions using Capacitor
 * This module provides native device access for mobile apps
 */

let isNative = false;

// Check if running in Capacitor
try {
  const { Capacitor } = require('@capacitor/core');
  isNative = Capacitor.isNativePlatform();
} catch (err) {
  // Not in Capacitor environment, will use web fallbacks
  isNative = false;
}

/**
 * Get location using Capacitor Geolocation (native) or web fallback
 */
export async function getLocationNative() {
  const native = await checkNative();
  if (native) {
    try {
      const { Geolocation } = await import('@capacitor/geolocation');
      
      // Request permission first
      const permission = await Geolocation.requestPermissions();
      if (permission.location !== 'granted') {
        return {
          success: false,
          error: 'Location permission denied. Please enable location access in your device settings.'
        };
      }
      
      // Get current position
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 20000
      });
      
      const { latitude, longitude } = position.coords;
      
      // Open in Google Maps
      const mapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
      const { App } = await import('@capacitor/app');
      await App.openUrl({ url: mapsUrl });
      
      return {
        success: true,
        message: `Opening map with your location`,
        location: { latitude, longitude },
        action: 'location_shared'
      };
    } catch (err) {
      console.error('Native geolocation error:', err);
      return {
        success: false,
        error: `Location error: ${err.message}`
      };
  }
  
  // Fallback to web geolocation
  return null; // Will use regular getLocation from deviceActions.js
}

/**
 * Set alarm using Capacitor Local Notifications
 */
export async function setAlarmNative(timeStr, message) {
  const native = await checkNative();
  if (native) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      
      // Request permission
      const permission = await LocalNotifications.requestPermissions();
      if (permission.display !== 'granted') {
        return {
          success: false,
          error: 'Notification permission denied. Please enable notifications in your device settings.'
        };
      }
      
      // Parse time
      const time = parseTimeString(timeStr);
      if (!time) {
        return {
          success: false,
          error: 'Could not parse time. Please specify time like "3:30 PM" or "15:30"'
        };
      }
      
      const now = new Date();
      const delay = time.getTime() - now.getTime();
      
      if (delay <= 0) {
        return {
          success: false,
          error: 'Alarm time must be in the future'
        };
      }
      
      // Schedule notification
      await LocalNotifications.schedule({
        notifications: [{
          title: 'Alarm',
          body: message || `Alarm: ${timeStr}`,
          id: Date.now(),
          schedule: { at: time },
          sound: 'default',
          attachments: null,
          actionTypeId: '',
          extra: null
        }]
      });
      
      return {
        success: true,
        message: `Alarm set for ${time.toLocaleTimeString()}`,
        action: 'alarm_set'
      };
    } catch (err) {
      console.error('Native alarm error:', err);
      return {
        success: false,
        error: `Failed to set alarm: ${err.message}`
      };
    }
  }
  
  return null; // Fallback to web
}

/**
 * Helper: Parse time string to Date object
 */
function parseTimeString(timeStr) {
  const now = new Date();
  const lower = timeStr.toLowerCase().trim();
  
  let hours, minutes;
  const hasAmPm = /(am|pm)/.test(lower);
  const amPmMatch = lower.match(/(am|pm)/);
  const isPM = amPm && amPmMatch && amPmMatch[1] === 'pm';
  
  const timeMatch = lower.match(/(\d{1,2}):?(\d{2})?/);
  if (timeMatch) {
    hours = parseInt(timeMatch[1]);
    minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    
    if (hasAmPm) {
      if (isPM && hours !== 12) hours += 12;
      if (!isPM && hours === 12) hours = 0;
    }
    
    const alarmTime = new Date();
    alarmTime.setHours(hours, minutes, 0, 0);
    
    if (alarmTime < now) {
      alarmTime.setDate(alarmTime.getDate() + 1);
    }
    
    return alarmTime;
  }
  
  return null;
}

/**
 * Check if running in native environment
 */
export async function isNativePlatform() {
  return await checkNative();
}
