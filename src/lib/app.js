import { loadConfig, initSupabase, checkAuth } from './supabase.js';
import { signIn, signUp, signOut } from './auth.js';
import {
  toggleSidebar,
  newChat,
  exportAllChats,
  //deleteCurrentChat,
  handleKeyDown,
  sendMessage
} from '../components/ui.js';

window.toggleSidebar = toggleSidebar;
window.newChat = newChat;
window.exportAllChats = exportAllChats;
//window.deleteCurrentChat = deleteCurrentChat;
window.handleKeyDown = handleKeyDown;
window.sendMessage = sendMessage;


document.addEventListener('DOMContentLoaded', async () => {
  console.log('app initializing...');

  const configLoaded = await loadConfig();
  if (!configLoaded) {
    alert('failed to load config');
    return;
  }

  const supabaseReady = await initSupabase();
  if (!supabaseReady) {
    alert('failed to initialize app. please refresh the page.');
    return;
  }

  const user = await checkAuth();
  if (user) {
    showMainApp();
    await loadUserData();
  } else {
    showAuthScreen();
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
      updateAuthStatus(
        'account created! please check your email to verify.',
        'success'
      );
      setTimeout(() => switchTab('signin'), 2000);
    } catch (error) {
      updateAuthStatus(error.message, 'error');
    }
  });
}
