import { loadConfig, initSupabase, checkAuth } from './supabase.js';
import { signIn, signUp, signOut } from './auth.js';
import { showMainApp, showAuthScreen, updateAuthStatus, loadUserData, switchTab } from '../components/ui.js';

document.addEventListener('DOMContentLoaded', async () => {
  console.log('app initializing...');
  await loadConfig();
  if (await initSupabase()) {
    // setupAuthListeners(); // implement if needed
    const user = await checkAuth();
    if (user) {
      showMainApp();
      await loadUserData();
    } else {
      showAuthScreen();
    }
  } else {
    alert('failed to initialize app. please refresh the page.');
  }
  setupEventListeners();
});

function setupEventListeners() {
  document.getElementById('signinForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('signinEmail').value;
    const password = document.getElementById('signinPassword').value;
    try {
      updateAuthStatus('signing in...', '');
      await signIn(email, password);
      updateAuthStatus('signed in successfully!', 'success');
    } catch (error) {
      updateAuthStatus(error.message, 'error');
    }
  });

  document.getElementById('signupForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const confirm = document.getElementById('signupConfirm').value;
    if (password !== confirm) {
      updateAuthStatus('passwords do not match', 'error');
      return;
    }
    if (password.length < 6) {
      updateAuthStatus('password must be at least 6 characters', 'error');
      return;
    }
    try {
      updateAuthStatus('creating account...', '');
      await signUp(email, password);
      updateAuthStatus('account created! please check your email to verify.', 'success');
      setTimeout(() => switchTab('signin'), 2000);
    } catch (error) {
      updateAuthStatus(error.message, 'error');
    }
  });

  // file input
  document.getElementById('fileInput')?.addEventListener('change', (e) => {
    Array.from(e.target.files).forEach(file => {
      attachedFiles.push(file);
    });
    renderAttachedFiles();
    e.target.value = '';
  });

  // textarea auto-resize
  const textarea = document.getElementById('userInput');
  if (textarea) {
    textarea.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 200) + 'px';
    });
  }

  // model/provider change - save to settings
  document.getElementById('modelSelect')?.addEventListener('change', async () => {
    const settings = {
      model: document.getElementById('modelSelect').value,
      provider: document.getElementById('providerSelect').value
    };
    await saveUserSettings(settings);
  });

  document.getElementById('providerSelect')?.addEventListener('change', async () => {
    const settings = {
      model: document.getElementById('modelSelect').value,
      provider: document.getElementById('providerSelect').value
    };
    await saveUserSettings(settings);
  });
}