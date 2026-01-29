import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://zjgecayphpejznilaolg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpqZ2VjYXlwaHBlanpuaWxhb2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2Mzk2MTIsImV4cCI6MjA4NDIxNTYxMn0.SHPC9iGk4a5SGYLMYBAmbGj2tuK-KhFho2oVeSfqGz0";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function checkAuth() {
  const { data } = await supabase.auth.getUser();
  window.currentUser = data?.user || null;
  return window.currentUser;
}
