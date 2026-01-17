import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

let supabase = null;
let currentUser = null;

/*
  EXPECTED:
  These are injected at runtime, e.g. via Railway → index.html

  window.SUPABASE_URL
  window.SUPABASE_ANON_KEY
*/

function getEnv() {
  const url = window.SUPABASE_URL;
  const anonKey = window.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.error("Supabase env vars missing on window");
    return null;
  }

  return { url, anonKey };
}

export async function initSupabase() {
  if (supabase) return true;

  const env = getEnv();
  if (!env) return false;

  supabase = createClient(env.url, env.anonKey);
  return true;
}

export async function checkAuth() {
  if (!supabase) {
    const ok = await initSupabase();
    if (!ok) return null;
  }

  const { data, error } = await supabase.auth.getUser();

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
  return "https://aibackend-production-a44f.up.railway.app";
}
