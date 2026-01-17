import { supabase } from "./supabase.js";

/* ========= SIGN IN ========= */

export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) throw error;
}

/* ========= SIGN UP ========= */

export async function signUp(email, password) {
  const { error } = await supabase.auth.signUp({
    email,
    password
  });

  if (error) throw error;
}

/* ========= SIGN OUT ========= */

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;

  window.location.reload();
}
