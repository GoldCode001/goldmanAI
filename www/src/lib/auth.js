import { supabase } from "./supabase.js";
import { initWallet, signMessage } from "./wallet.js";
import { deriveKeyFromSignature } from "./encryption.js";

/**
 * Initializes the crypto session invisibly.
 * Called automatically after signUp or signIn.
 */
async function initCryptoSession() {
  try {
    const address = await initWallet(); // Creates/loads invisible wallet
    const signature = await signMessage("Login to Goldman AI"); // Signs invisibly
    const key = await deriveKeyFromSignature(signature);
    
    window.sessionKey = key;
    
    // Update user object with wallet info
    if (window.currentUser) {
      window.currentUser.isCrypto = true;
      window.currentUser.walletAddress = address;
    }
    
    return { address, key };
  } catch (err) {
    console.error("Failed to init crypto session:", err);
    // Don't block auth, but encryption won't work
  }
}

export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  
  // Initialize wallet & encryption immediately
  await initCryptoSession();
}

export async function signUp(email, password) {
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  
  // Initialize wallet & encryption immediately
  await initCryptoSession();
}

export async function signOut() {
  window.sessionKey = null;
  await supabase.auth.signOut();
  location.reload();
}
