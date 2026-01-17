
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
  if (!config) {
    const loaded = await loadConfig();
    if (!loaded) return false;
  }

  try {
    if (!window.supabase || !window.supabase.createClient) {
      throw new Error('Supabase library not found');
    }
    supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
    console.log('supabase initialized');
    return true;
  } catch (error) {
    console.error('failed to initialize supabase:', error);
    return false;
  }
}

export async function checkAuth() {
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

export function getSupabase() {
  return supabase;
}

export function getCurrentUser() {
  return currentUser;
}

export function getApiEndpoint() {
  return config?.apiEndpoint || '';
}