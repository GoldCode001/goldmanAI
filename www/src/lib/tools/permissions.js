/**
 * Permissions Management
 * Tracks and manages user permissions for AI capabilities
 */

import { supabase } from '../supabase.js';

const API = "https://aibackend-production-a44f.up.railway.app";

// Permission states
export const PermissionState = {
  GRANTED: 'granted',
  DENIED: 'denied',
  PROMPT: 'prompt', // User hasn't decided yet
  UNAVAILABLE: 'unavailable', // Platform doesn't support it
};

// Default permissions (conservative - most things need approval)
const DEFAULT_PERMISSIONS = {
  // Always allowed (safe)
  memory_read: PermissionState.GRANTED,
  memory_write: PermissionState.GRANTED,
  calculations: PermissionState.GRANTED,
  datetime: PermissionState.GRANTED,
  goals_read: PermissionState.GRANTED,
  goals_write: PermissionState.GRANTED,
  habits_read: PermissionState.GRANTED,
  habits_write: PermissionState.GRANTED,

  // Needs first-time approval
  web_search: PermissionState.PROMPT,
  weather: PermissionState.PROMPT,
  reminders: PermissionState.PROMPT,
  timers: PermissionState.PROMPT,

  // Sensitive - always prompt
  location: PermissionState.PROMPT,
  notifications: PermissionState.PROMPT,
  camera: PermissionState.PROMPT,
  clipboard_read: PermissionState.PROMPT,
  clipboard_write: PermissionState.PROMPT,
  calendar_read: PermissionState.PROMPT,
  calendar_write: PermissionState.PROMPT,
  contacts_read: PermissionState.PROMPT,
  filesystem_read: PermissionState.PROMPT,
  filesystem_write: PermissionState.PROMPT,
};

// In-memory cache of user permissions
let permissionsCache = null;

/**
 * Load user permissions from storage
 */
export async function loadPermissions() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      permissionsCache = { ...DEFAULT_PERMISSIONS };
      return permissionsCache;
    }

    const res = await fetch(`${API}/api/user/memory?userId=${user.id}`);
    if (!res.ok) {
      permissionsCache = { ...DEFAULT_PERMISSIONS };
      return permissionsCache;
    }

    const data = await res.json();
    const memory = data.memory || {};

    // Merge saved permissions with defaults
    permissionsCache = {
      ...DEFAULT_PERMISSIONS,
      ...(memory.aiPermissions || {})
    };

    return permissionsCache;
  } catch (err) {
    console.error('Failed to load permissions:', err);
    permissionsCache = { ...DEFAULT_PERMISSIONS };
    return permissionsCache;
  }
}

/**
 * Save user permissions to storage
 */
export async function savePermissions(permissions) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    // Load existing memory
    const res = await fetch(`${API}/api/user/memory?userId=${user.id}`);
    const data = await res.json();
    const memory = data.memory || {};

    // Update permissions
    memory.aiPermissions = permissions;

    // Save
    const saveRes = await fetch(`${API}/api/user/memory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, memory })
    });

    if (saveRes.ok) {
      permissionsCache = permissions;
    }

    return saveRes.ok;
  } catch (err) {
    console.error('Failed to save permissions:', err);
    return false;
  }
}

/**
 * Check if a permission is granted
 */
export async function checkPermission(permission) {
  if (!permissionsCache) {
    await loadPermissions();
  }
  return permissionsCache[permission] || PermissionState.PROMPT;
}

/**
 * Request a permission from the user
 * Returns a promise that resolves when user decides
 */
export async function requestPermission(permission, reason) {
  const currentState = await checkPermission(permission);

  // Already granted or denied
  if (currentState === PermissionState.GRANTED) {
    return true;
  }
  if (currentState === PermissionState.DENIED) {
    return false;
  }

  // Show permission dialog
  return new Promise((resolve) => {
    showPermissionDialog(permission, reason, async (granted) => {
      // Update permission state
      if (!permissionsCache) {
        await loadPermissions();
      }
      permissionsCache[permission] = granted ? PermissionState.GRANTED : PermissionState.DENIED;
      await savePermissions(permissionsCache);
      resolve(granted);
    });
  });
}

/**
 * Grant a permission programmatically
 */
export async function grantPermission(permission) {
  if (!permissionsCache) {
    await loadPermissions();
  }
  permissionsCache[permission] = PermissionState.GRANTED;
  await savePermissions(permissionsCache);
}

/**
 * Revoke a permission
 */
export async function revokePermission(permission) {
  if (!permissionsCache) {
    await loadPermissions();
  }
  permissionsCache[permission] = PermissionState.DENIED;
  await savePermissions(permissionsCache);
}

/**
 * Reset a permission to prompt state
 */
export async function resetPermission(permission) {
  if (!permissionsCache) {
    await loadPermissions();
  }
  permissionsCache[permission] = PermissionState.PROMPT;
  await savePermissions(permissionsCache);
}

/**
 * Get all permissions
 */
export async function getAllPermissions() {
  if (!permissionsCache) {
    await loadPermissions();
  }
  return { ...permissionsCache };
}

/**
 * Show permission dialog UI
 */
function showPermissionDialog(permission, reason, callback) {
  // Create dialog overlay
  const overlay = document.createElement('div');
  overlay.className = 'permission-dialog-overlay';
  overlay.innerHTML = `
    <div class="permission-dialog">
      <div class="permission-icon">${getPermissionIcon(permission)}</div>
      <h3>Permission Request</h3>
      <p class="permission-name">${formatPermissionName(permission)}</p>
      <p class="permission-reason">${reason || 'The AI would like to use this feature to help you.'}</p>
      <div class="permission-buttons">
        <button class="permission-deny">Deny</button>
        <button class="permission-allow">Allow</button>
      </div>
    </div>
  `;

  // Add styles if not already present
  if (!document.getElementById('permission-dialog-styles')) {
    const style = document.createElement('style');
    style.id = 'permission-dialog-styles';
    style.textContent = `
      .permission-dialog-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.2s ease;
      }
      .permission-dialog {
        background: #1a1a2e;
        border-radius: 16px;
        padding: 24px;
        max-width: 320px;
        text-align: center;
        border: 1px solid rgba(255, 255, 255, 0.1);
        animation: slideUp 0.3s ease;
      }
      .permission-icon {
        font-size: 48px;
        margin-bottom: 16px;
      }
      .permission-dialog h3 {
        margin: 0 0 8px;
        color: #fff;
        font-size: 18px;
      }
      .permission-name {
        color: #00d4ff;
        font-weight: 600;
        margin: 0 0 12px;
      }
      .permission-reason {
        color: rgba(255, 255, 255, 0.7);
        font-size: 14px;
        margin: 0 0 20px;
        line-height: 1.5;
      }
      .permission-buttons {
        display: flex;
        gap: 12px;
      }
      .permission-buttons button {
        flex: 1;
        padding: 12px;
        border-radius: 8px;
        border: none;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }
      .permission-deny {
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
      }
      .permission-deny:hover {
        background: rgba(255, 255, 255, 0.2);
      }
      .permission-allow {
        background: #00d4ff;
        color: #000;
      }
      .permission-allow:hover {
        background: #00b8e0;
      }
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes slideUp {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(overlay);

  // Handle button clicks
  overlay.querySelector('.permission-deny').addEventListener('click', () => {
    overlay.remove();
    callback(false);
  });

  overlay.querySelector('.permission-allow').addEventListener('click', () => {
    overlay.remove();
    callback(true);
  });
}

/**
 * Get icon for permission type
 */
function getPermissionIcon(permission) {
  const icons = {
    location: '📍',
    notifications: '🔔',
    camera: '📷',
    clipboard_read: '📋',
    clipboard_write: '📋',
    calendar_read: '📅',
    calendar_write: '📅',
    contacts_read: '👥',
    web_search: '🔍',
    weather: '🌤️',
    reminders: '⏰',
    timers: '⏱️',
  };
  return icons[permission] || '🔧';
}

/**
 * Format permission name for display
 */
function formatPermissionName(permission) {
  const names = {
    location: 'Location Access',
    notifications: 'Send Notifications',
    camera: 'Camera Access',
    clipboard_read: 'Read Clipboard',
    clipboard_write: 'Write to Clipboard',
    calendar_read: 'Read Calendar',
    calendar_write: 'Create Calendar Events',
    contacts_read: 'Read Contacts',
    web_search: 'Web Search',
    weather: 'Weather Information',
    reminders: 'Set Reminders',
    timers: 'Set Timers',
  };
  return names[permission] || permission.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
