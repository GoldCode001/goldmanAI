// supabase client
let supabase = null;
let currentUser = null;
let config = null;

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