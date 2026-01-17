import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

let supabase = null;
let currentUser = null;
let config = null;

export async function loadConfig() {
  try {
    const response = await fetch('/api/config');
    config = await response.json();
    return true;
  } catch (error) {
    console.error('failed to load config:', error);
    return false;
  }
}

export async function initSupabase() {
  if (supabase) return true;

  if (!config) {
    const loaded = await loadConfig();
    if (!loaded) return false;
  }

  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    console.error('missing supabase config');
    return false;
  }

  supabase = createClient(
    config.supabaseUrl,
    config.supabaseAnonKey
  );

  return true;
}

export async function checkAuth() {
  if (!supabase) {
    const ok = await initSupabase();
    if (!ok) return null;
  }

  const { data, error } = await supabase.auth.getUser();

  // THIS IS NORMAL — user just not logged in
  if (error && error.name === "AuthSessionMissingError") {
    return null;
  }

  if (error) {
    console.error("auth check failed:", error);
    return null;
  }

  currentUser = data.user;
  window.currentUser = data.user;
  return data.user;
}


export function getSupabase() {
  return supabase;
}

export function getCurrentUser() {
  return currentUser;
}

export function getApiEndpoint() {
  return config?.apiEndpoint || '';
}
