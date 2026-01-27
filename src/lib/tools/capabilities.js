/**
 * Capabilities Detection
 * Detects what features are available on the current platform
 */

// Cache capabilities after first detection
let cachedCapabilities = null;

// Check if Capacitor is available (works in both web and native)
function getCapacitor() {
  if (typeof window !== 'undefined' && window.Capacitor) {
    return window.Capacitor;
  }
  return null;
}

/**
 * Detect all available capabilities
 */
export async function detectCapabilities() {
  if (cachedCapabilities) {
    return cachedCapabilities;
  }

  const Capacitor = getCapacitor();
  const isNative = Capacitor ? Capacitor.isNativePlatform() : false;
  const platform = Capacitor ? Capacitor.getPlatform() : 'web';

  const capabilities = {
    platform,
    isNative,
    isWeb: platform === 'web',
    isIOS: platform === 'ios',
    isAndroid: platform === 'android',

    // Core capabilities (always available)
    memory: true,
    webSearch: true,
    calculations: true,
    dateTime: true,

    // Web APIs (may need permission)
    geolocation: 'geolocation' in navigator,
    notifications: 'Notification' in window,
    clipboard: 'clipboard' in navigator,
    speech: 'speechSynthesis' in window,
    camera: !!(navigator.mediaDevices?.getUserMedia),

    // Native-only capabilities (via Capacitor)
    nativeNotifications: isNative,
    nativeGeolocation: isNative,
    nativeCamera: isNative,
    nativeFilesystem: isNative,
    calendar: isNative, // Would need @capacitor-community/calendar
    contacts: isNative, // Would need @capacitor-community/contacts
    haptics: isNative,

    // Feature flags for gradual rollout
    features: {
      reminders: true,
      goals: true,
      habits: true,
      webSearch: true,
      weather: true, // Via API
      timers: true,
    }
  };

  cachedCapabilities = capabilities;
  return capabilities;
}

/**
 * Check if a specific capability is available
 */
export async function hasCapability(capability) {
  const caps = await detectCapabilities();

  // Handle nested capability checks (e.g., "features.reminders")
  if (capability.includes('.')) {
    const parts = capability.split('.');
    let value = caps;
    for (const part of parts) {
      value = value?.[part];
    }
    return !!value;
  }

  return !!caps[capability];
}

/**
 * Get platform-specific info
 */
export function getPlatformInfo() {
  return {
    platform: Capacitor.getPlatform(),
    isNative: Capacitor.isNativePlatform(),
    userAgent: navigator.userAgent,
    language: navigator.language,
    online: navigator.onLine,
  };
}

/**
 * Clear cached capabilities (useful when permissions change)
 */
export function clearCapabilitiesCache() {
  cachedCapabilities = null;
}
