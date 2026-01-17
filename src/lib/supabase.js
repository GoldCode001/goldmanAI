import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

/* ========= SUPABASE CONFIG ========= */

const SUPABASE_URL = "https://zjgecayphpejznilaolg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpqZ2VjYXlwaHBlanpuaWxhb2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2Mzk2MTIsImV4cCI6MjA4NDIxNTYxMn0.SHPC9iGk4a5SGYLMYBAmbGj2tuK-KhFho2oVeSfqGz0";

/* ========= CLIENT ========= */

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

let currentUser = null;

/* ========= AUTH ========= */

export async function checkAuth() {
  const { data, error } = await supabase.auth.getUser();

  // user simply not logged in (normal)
  if (error && error.name === "AuthSessionMissingError") {
    return null;
  }

  if (error) {
    console.error("auth error:", error);
    return null;
  }

  currentUser = data.user;
  window.currentUser = data.user;
  return data.user;
}

export function getCurrentUser() {
  return currentUser;
}
