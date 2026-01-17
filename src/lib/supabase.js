// supabase client
if (typeof window !== 'undefined') {
  if (!window.__supabase_singleton) {
    window.__supabase_singleton = { supabase: null, currentUser: null, config: null };
  }
  var supabase = window.__supabase_singleton.supabase;
  var currentUser = window.__supabase_singleton.currentUser;
  var config = window.__supabase_singleton.config;
} else {
  var supabase = null;
  var currentUser = null;
  var config = null;
}

async function loadConfig() {
  try {
    const response = await fetch('/api/config');
    config = await response.json();
    return true;
  } catch (error) {
    console.error('failed to load config:', error);
    return false;
  }
}

async function initSupabase() {
  if (!config) {
    const loaded = await loadConfig();
    if (!loaded) return false;
  }

  try {
    supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
    console.log('supabase initialized');
    return true;
  } catch (error) {
    console.error('failed to initialize supabase:', error);
    return false;
  }
}

async function checkAuth() {
  if (!supabase) {
    if (!await initSupabase()) {
      return null;
    }
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) throw error;
    
    currentUser = user;
    return user;
  } catch (error) {
    console.error('auth check failed:', error);
    return null;
  }
}

function getSupabase() {
  return supabase;
}

function getCurrentUser() {
  return currentUser;
}

function getApiEndpoint() {
  return config?.apiEndpoint || '';
}