/**
 * Onboarding Component
 * Shows first-time users a welcome screen and requests all permissions upfront
 */

import { supabase } from '../lib/supabase.js';
import { grantPermission, getAllPermissions, PermissionState } from '../lib/tools/permissions.js';

const API = "https://aibackend-production-a44f.up.railway.app";

// Permission groups to request
const PERMISSION_GROUPS = [
  {
    id: 'memory',
    title: 'Memory & Learning',
    description: 'Remember your preferences, facts about you, and learn from conversations',
    icon: '🧠',
    permissions: ['memory_read', 'memory_write'],
    default: true
  },
  {
    id: 'goals',
    title: 'Goals & Habits',
    description: 'Track your goals and help build positive habits',
    icon: '🎯',
    permissions: ['goals_read', 'goals_write', 'habits_read', 'habits_write'],
    default: true
  },
  {
    id: 'reminders',
    title: 'Reminders & Timers',
    description: 'Set reminders and timers to help you stay on track',
    icon: '⏰',
    permissions: ['reminders', 'timers'],
    default: true
  },
  {
    id: 'search',
    title: 'Web Search',
    description: 'Search the web for up-to-date information',
    icon: '🔍',
    permissions: ['web_search', 'weather'],
    default: true
  },
  {
    id: 'notifications',
    title: 'Notifications',
    description: 'Send you notifications for reminders and important updates',
    icon: '🔔',
    permissions: ['notifications'],
    default: true
  },
  {
    id: 'location',
    title: 'Location',
    description: 'Use your location for weather and local recommendations',
    icon: '📍',
    permissions: ['location'],
    default: false
  },
  {
    id: 'calendar',
    title: 'Calendar',
    description: 'View and create calendar events',
    icon: '📅',
    permissions: ['calendar_read', 'calendar_write'],
    default: false
  },
  {
    id: 'contacts',
    title: 'Contacts',
    description: 'Access your contacts to help with communication',
    icon: '👥',
    permissions: ['contacts_read'],
    default: false
  },
  {
    id: 'files',
    title: 'Notes & Files',
    description: 'Save and read notes for you',
    icon: '📝',
    permissions: ['filesystem_read', 'filesystem_write'],
    default: false
  },
  {
    id: 'clipboard',
    title: 'Clipboard',
    description: 'Copy text to your clipboard when you ask',
    icon: '📋',
    permissions: ['clipboard_read', 'clipboard_write'],
    default: false
  }
];

/**
 * Check if onboarding has been completed
 */
export async function checkOnboardingComplete() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const res = await fetch(`${API}/api/user/memory?userId=${user.id}`);
    if (!res.ok) return false;

    const data = await res.json();
    return data.memory?.onboardingComplete === true;
  } catch (err) {
    console.error('Error checking onboarding:', err);
    return false;
  }
}

/**
 * Mark onboarding as complete
 */
export async function markOnboardingComplete() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const res = await fetch(`${API}/api/user/memory?userId=${user.id}`);
    const data = await res.json();
    const memory = data.memory || {};

    memory.onboardingComplete = true;
    memory.onboardingDate = new Date().toISOString();

    await fetch(`${API}/api/user/memory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, memory })
    });

    return true;
  } catch (err) {
    console.error('Error marking onboarding complete:', err);
    return false;
  }
}

/**
 * Render the onboarding screen
 */
export function renderOnboarding(container, onComplete) {
  // Add styles
  if (!document.getElementById('onboarding-styles')) {
    const style = document.createElement('style');
    style.id = 'onboarding-styles';
    style.textContent = getOnboardingStyles();
    document.head.appendChild(style);
  }

  const overlay = document.createElement('div');
  overlay.className = 'onboarding-overlay';
  overlay.innerHTML = `
    <div class="onboarding-container">
      <!-- Step 1: Welcome -->
      <div class="onboarding-step active" data-step="1">
        <div class="onboarding-face">
          <svg viewBox="0 0 200 200" class="welcome-face">
            <defs>
              <filter id="glow-ob">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            <circle cx="100" cy="100" r="80" fill="rgba(0, 212, 255, 0.1)" stroke="#00d4ff" stroke-width="2" filter="url(#glow-ob)"/>
            <ellipse cx="65" cy="85" rx="12" ry="16" fill="#00d4ff"/>
            <ellipse cx="135" cy="85" rx="12" ry="16" fill="#00d4ff"/>
            <path d="M 60 125 Q 100 155 140 125" fill="none" stroke="#00d4ff" stroke-width="4" stroke-linecap="round"/>
          </svg>
        </div>
        <h1 class="onboarding-title">Welcome to PAL</h1>
        <p class="onboarding-subtitle">Your Personal AI Assistant</p>
        <p class="onboarding-desc">
          I'm here to help you stay organized, remember important things, and achieve your goals.
          Let me introduce myself and set things up for you.
        </p>
        <button class="onboarding-btn primary" data-action="next">Get Started</button>
      </div>

      <!-- Step 2: Permissions -->
      <div class="onboarding-step" data-step="2">
        <h2 class="onboarding-title">What can I help with?</h2>
        <p class="onboarding-desc">
          Choose what you'd like me to help you with. You can change these anytime in settings.
        </p>
        <div class="permission-grid" id="permission-grid">
          ${PERMISSION_GROUPS.map(group => `
            <label class="permission-card ${group.default ? 'selected' : ''}" data-group="${group.id}">
              <input type="checkbox" ${group.default ? 'checked' : ''} data-permissions="${group.permissions.join(',')}">
              <span class="permission-icon">${group.icon}</span>
              <span class="permission-title">${group.title}</span>
              <span class="permission-desc">${group.description}</span>
              <span class="permission-check">✓</span>
            </label>
          `).join('')}
        </div>
        <div class="onboarding-buttons">
          <button class="onboarding-btn secondary" data-action="back">Back</button>
          <button class="onboarding-btn primary" data-action="next">Continue</button>
        </div>
      </div>

      <!-- Step 3: Name -->
      <div class="onboarding-step" data-step="3">
        <h2 class="onboarding-title">What should I call you?</h2>
        <p class="onboarding-desc">
          I'd love to get to know you better!
        </p>
        <input type="text" class="onboarding-input" id="user-name-input" placeholder="Enter your name" autocomplete="off">
        <div class="onboarding-buttons">
          <button class="onboarding-btn secondary" data-action="back">Back</button>
          <button class="onboarding-btn primary" data-action="finish">Let's Go!</button>
        </div>
      </div>

      <!-- Progress dots -->
      <div class="onboarding-progress">
        <span class="progress-dot active" data-step="1"></span>
        <span class="progress-dot" data-step="2"></span>
        <span class="progress-dot" data-step="3"></span>
      </div>
    </div>
  `;

  container.appendChild(overlay);

  // State
  let currentStep = 1;
  const selectedPermissions = new Set();

  // Initialize default permissions
  PERMISSION_GROUPS.forEach(group => {
    if (group.default) {
      group.permissions.forEach(p => selectedPermissions.add(p));
    }
  });

  // Event listeners
  overlay.addEventListener('click', async (e) => {
    const action = e.target.dataset?.action;

    if (action === 'next') {
      goToStep(currentStep + 1);
    } else if (action === 'back') {
      goToStep(currentStep - 1);
    } else if (action === 'finish') {
      await finishOnboarding();
    }

    // Permission card toggle
    const card = e.target.closest('.permission-card');
    if (card) {
      const checkbox = card.querySelector('input[type="checkbox"]');
      const permissions = checkbox.dataset.permissions.split(',');

      if (checkbox.checked) {
        card.classList.remove('selected');
        checkbox.checked = false;
        permissions.forEach(p => selectedPermissions.delete(p));
      } else {
        card.classList.add('selected');
        checkbox.checked = true;
        permissions.forEach(p => selectedPermissions.add(p));
      }
    }
  });

  function goToStep(step) {
    if (step < 1 || step > 3) return;

    // Hide current step
    overlay.querySelector(`.onboarding-step[data-step="${currentStep}"]`).classList.remove('active');
    overlay.querySelector(`.progress-dot[data-step="${currentStep}"]`).classList.remove('active');

    // Show new step
    currentStep = step;
    overlay.querySelector(`.onboarding-step[data-step="${currentStep}"]`).classList.add('active');
    overlay.querySelector(`.progress-dot[data-step="${currentStep}"]`).classList.add('active');

    // Focus name input on step 3
    if (step === 3) {
      setTimeout(() => {
        overlay.querySelector('#user-name-input').focus();
      }, 300);
    }
  }

  async function finishOnboarding() {
    const nameInput = overlay.querySelector('#user-name-input');
    const userName = nameInput.value.trim();

    // Grant selected permissions
    for (const permission of selectedPermissions) {
      await grantPermission(permission);
    }

    // Save user name if provided
    if (userName) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const res = await fetch(`${API}/api/user/memory?userId=${user.id}`);
          const data = await res.json();
          const memory = data.memory || {};

          if (!memory.facts) memory.facts = [];
          memory.facts.push({
            id: Date.now().toString(),
            fact: `User's name is ${userName}`,
            category: 'personal',
            timestamp: new Date().toISOString()
          });

          await fetch(`${API}/api/user/memory`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id, memory })
          });
        }
      } catch (err) {
        console.error('Error saving user name:', err);
      }
    }

    // Mark onboarding complete
    await markOnboardingComplete();

    // Animate out
    overlay.classList.add('closing');
    setTimeout(() => {
      overlay.remove();
      if (onComplete) onComplete({ userName, permissions: Array.from(selectedPermissions) });
    }, 300);
  }
}

/**
 * Get onboarding styles
 */
function getOnboardingStyles() {
  return `
    .onboarding-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(135deg, #0a0a1a 0%, #1a1a3e 100%);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: fadeIn 0.3s ease;
    }

    .onboarding-overlay.closing {
      animation: fadeOut 0.3s ease forwards;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes fadeOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }

    .onboarding-container {
      max-width: 500px;
      width: 90%;
      padding: 40px;
      text-align: center;
      position: relative;
    }

    .onboarding-step {
      display: none;
      animation: slideIn 0.3s ease;
    }

    .onboarding-step.active {
      display: block;
    }

    @keyframes slideIn {
      from { opacity: 0; transform: translateX(20px); }
      to { opacity: 1; transform: translateX(0); }
    }

    .onboarding-face {
      margin-bottom: 24px;
    }

    .welcome-face {
      width: 150px;
      height: 150px;
      animation: float 3s ease-in-out infinite;
    }

    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }

    .onboarding-title {
      font-size: 28px;
      font-weight: 700;
      color: #fff;
      margin: 0 0 8px;
    }

    .onboarding-subtitle {
      font-size: 16px;
      color: #00d4ff;
      margin: 0 0 20px;
    }

    .onboarding-desc {
      font-size: 15px;
      color: rgba(255, 255, 255, 0.7);
      line-height: 1.6;
      margin: 0 0 32px;
    }

    .onboarding-btn {
      padding: 14px 32px;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      border: none;
    }

    .onboarding-btn.primary {
      background: linear-gradient(135deg, #00d4ff, #0088ff);
      color: #fff;
    }

    .onboarding-btn.primary:hover {
      transform: scale(1.05);
      box-shadow: 0 4px 20px rgba(0, 212, 255, 0.4);
    }

    .onboarding-btn.secondary {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
      margin-right: 12px;
    }

    .onboarding-btn.secondary:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    .onboarding-buttons {
      display: flex;
      justify-content: center;
      gap: 12px;
    }

    .permission-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      margin-bottom: 32px;
      max-height: 350px;
      overflow-y: auto;
      padding: 4px;
    }

    .permission-card {
      background: rgba(255, 255, 255, 0.05);
      border: 2px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 16px 12px;
      cursor: pointer;
      transition: all 0.2s;
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }

    .permission-card:hover {
      border-color: rgba(0, 212, 255, 0.5);
      background: rgba(255, 255, 255, 0.08);
    }

    .permission-card.selected {
      border-color: #00d4ff;
      background: rgba(0, 212, 255, 0.1);
    }

    .permission-card input {
      display: none;
    }

    .permission-icon {
      font-size: 28px;
      margin-bottom: 8px;
    }

    .permission-title {
      font-size: 14px;
      font-weight: 600;
      color: #fff;
      margin-bottom: 4px;
    }

    .permission-desc {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.5);
      line-height: 1.4;
    }

    .permission-check {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #00d4ff;
      color: #000;
      font-size: 12px;
      display: none;
      align-items: center;
      justify-content: center;
    }

    .permission-card.selected .permission-check {
      display: flex;
    }

    .onboarding-input {
      width: 100%;
      max-width: 300px;
      padding: 16px 20px;
      border-radius: 12px;
      border: 2px solid rgba(255, 255, 255, 0.2);
      background: rgba(255, 255, 255, 0.05);
      color: #fff;
      font-size: 18px;
      text-align: center;
      outline: none;
      transition: border-color 0.2s;
      margin-bottom: 32px;
    }

    .onboarding-input:focus {
      border-color: #00d4ff;
    }

    .onboarding-input::placeholder {
      color: rgba(255, 255, 255, 0.3);
    }

    .onboarding-progress {
      position: absolute;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 8px;
    }

    .progress-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.2);
      transition: all 0.3s;
    }

    .progress-dot.active {
      background: #00d4ff;
      transform: scale(1.2);
    }

    /* Mobile adjustments */
    @media (max-width: 500px) {
      .onboarding-container {
        padding: 24px;
      }

      .permission-grid {
        grid-template-columns: 1fr;
        max-height: 280px;
      }

      .permission-card {
        flex-direction: row;
        text-align: left;
        gap: 12px;
      }

      .permission-icon {
        margin-bottom: 0;
      }

      .permission-card > span:not(.permission-icon):not(.permission-check) {
        flex: 1;
      }

      .permission-title {
        margin-bottom: 2px;
      }
    }
  `;
}

export { PERMISSION_GROUPS };
