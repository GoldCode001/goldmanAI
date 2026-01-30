/**
 * Onboarding Component
 * Welcomes new users and requests necessary permissions
 * Matches existing PAL branding (black/cyan theme)
 */

const STORAGE_KEY = 'pal_onboarding_complete';

/**
 * Check if onboarding has been completed
 */
export function isOnboardingComplete() {
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

/**
 * Mark onboarding as complete
 */
export function markOnboardingComplete() {
  localStorage.setItem(STORAGE_KEY, 'true');
}

/**
 * Show the onboarding overlay
 * @param {Function} onComplete - Called when onboarding finishes
 */
export function showOnboarding(onComplete) {
  // Don't show if already completed
  if (isOnboardingComplete()) {
    if (onComplete) onComplete();
    return;
  }

  // Create overlay
  const overlay = document.createElement('div');
  overlay.id = 'onboarding-overlay';
  overlay.innerHTML = `
    <style>
      #onboarding-overlay {
        position: fixed;
        inset: 0;
        background: #000;
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: 'Space Grotesk', sans-serif;
      }

      .onboard-container {
        max-width: 400px;
        width: 90%;
        text-align: center;
        padding: 40px;
      }

      .onboard-logo {
        font-size: 48px;
        margin-bottom: 16px;
      }

      .onboard-title {
        font-size: 32px;
        font-weight: 600;
        color: #fff;
        margin: 0 0 8px 0;
      }

      .onboard-subtitle {
        font-size: 16px;
        color: #00ffff;
        margin: 0 0 32px 0;
      }

      .onboard-desc {
        font-size: 15px;
        color: #888;
        line-height: 1.6;
        margin: 0 0 32px 0;
      }

      .onboard-permissions {
        background: #111;
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 24px;
        text-align: left;
      }

      .onboard-permissions h3 {
        font-size: 14px;
        color: #666;
        margin: 0 0 16px 0;
        text-transform: uppercase;
        letter-spacing: 1px;
      }

      .perm-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 0;
        border-bottom: 1px solid #222;
      }

      .perm-item:last-child {
        border-bottom: none;
      }

      .perm-icon {
        font-size: 20px;
        width: 32px;
        text-align: center;
      }

      .perm-info {
        flex: 1;
      }

      .perm-name {
        font-size: 15px;
        color: #fff;
        margin: 0 0 2px 0;
      }

      .perm-desc {
        font-size: 13px;
        color: #666;
        margin: 0;
      }

      .perm-toggle {
        position: relative;
        width: 44px;
        height: 24px;
        background: #333;
        border-radius: 12px;
        cursor: pointer;
        transition: background 0.2s;
      }

      .perm-toggle.on {
        background: #00ffff;
      }

      .perm-toggle::after {
        content: '';
        position: absolute;
        top: 2px;
        left: 2px;
        width: 20px;
        height: 20px;
        background: #fff;
        border-radius: 50%;
        transition: transform 0.2s;
      }

      .perm-toggle.on::after {
        transform: translateX(20px);
      }

      .onboard-btn {
        width: 100%;
        padding: 16px;
        background: #00ffff;
        color: #000;
        border: none;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        transition: opacity 0.2s;
        font-family: 'Space Grotesk', sans-serif;
      }

      .onboard-btn:hover {
        opacity: 0.9;
      }

      .onboard-skip {
        margin-top: 16px;
        background: transparent;
        border: none;
        color: #666;
        font-size: 14px;
        cursor: pointer;
        font-family: 'Space Grotesk', sans-serif;
      }

      .onboard-skip:hover {
        color: #888;
      }
    </style>

    <div class="onboard-container">
      <div class="onboard-logo">&#129302;</div>
      <h1 class="onboard-title">Welcome to PAL</h1>
      <p class="onboard-subtitle">Your Personal AI Assistant</p>
      <p class="onboard-desc">
        PAL needs a few permissions to help you best. You can change these anytime in your browser settings.
      </p>

      <div class="onboard-permissions">
        <h3>Permissions</h3>

        <div class="perm-item">
          <span class="perm-icon">&#127908;</span>
          <div class="perm-info">
            <p class="perm-name">Microphone</p>
            <p class="perm-desc">For voice conversations</p>
          </div>
          <div class="perm-toggle on" data-perm="microphone"></div>
        </div>

        <div class="perm-item">
          <span class="perm-icon">&#128276;</span>
          <div class="perm-info">
            <p class="perm-name">Notifications</p>
            <p class="perm-desc">For reminders & updates</p>
          </div>
          <div class="perm-toggle on" data-perm="notifications"></div>
        </div>
      </div>

      <button class="onboard-btn" id="onboard-continue">Continue</button>
      <button class="onboard-skip" id="onboard-skip">Skip for now</button>
    </div>
  `;

  document.body.appendChild(overlay);

  // Toggle handlers
  overlay.querySelectorAll('.perm-toggle').forEach(toggle => {
    toggle.addEventListener('click', () => {
      toggle.classList.toggle('on');
    });
  });

  // Continue button
  overlay.querySelector('#onboard-continue').addEventListener('click', async () => {
    const permissions = {};

    overlay.querySelectorAll('.perm-toggle').forEach(toggle => {
      permissions[toggle.dataset.perm] = toggle.classList.contains('on');
    });

    // Request permissions that are enabled
    if (permissions.microphone) {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (e) {
        console.log('Microphone permission denied or unavailable');
      }
    }

    if (permissions.notifications && 'Notification' in window) {
      try {
        await Notification.requestPermission();
      } catch (e) {
        console.log('Notification permission denied or unavailable');
      }
    }

    // Mark complete and close
    markOnboardingComplete();
    overlay.remove();
    if (onComplete) onComplete();
  });

  // Skip button
  overlay.querySelector('#onboard-skip').addEventListener('click', () => {
    markOnboardingComplete();
    overlay.remove();
    if (onComplete) onComplete();
  });
}

export default {
  isOnboardingComplete,
  markOnboardingComplete,
  showOnboarding
};
