import { getSupabase, getCurrentUser } from './supabase.js';
import { showAuthScreen } from '../components/ui.js';

export async function signIn(email, password) {
    const supabase = getSupabase();
    if (!supabase) {
        throw new Error('supabase not initialized. please configure it first.');
    }
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('sign in failed:', error);
        throw error;
    }
}

export async function signUp(email, password) {
    const supabase = getSupabase();
    if (!supabase) {
        throw new Error('supabase not initialized. please configure it first.');
    }
    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password
        });
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('sign up failed:', error);
        throw error;
    }
}

export async function signOut() {
    const supabase = getSupabase();
    if (!supabase) return;
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        // redirect to auth screen
        showAuthScreen();
    } catch (error) {
        console.error('sign out failed:', error);
        throw error;
    }
}

// auth event listeners
function setupAuthListeners() {
    if (!supabase) return;

    supabase.auth.onAuthStateChange((event, session) => {
        console.log('auth state changed:', event);
        
        if (event === 'SIGNED_IN') {
            currentUser = session?.user || null;
            showMainApp();
            loadUserData();
        } else if (event === 'SIGNED_OUT') {
            currentUser = null;
            showAuthScreen();
        }
    });
}
