/**
 * Memory & Personalization System
 * Stores and retrieves user preferences, facts, and conversation context
 */

import { supabase } from "./supabase.js";

const API = "https://aibackend-production-a44f.up.railway.app";

/**
 * Get user memory/preferences
 */
export async function getUserMemory() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const res = await fetch(`${API}/api/user/memory?userId=${user.id}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" }
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.memory || {};
  } catch (err) {
    console.error('Failed to load user memory:', err);
    return null;
  }
}

/**
 * Save user memory/preferences
 */
export async function saveUserMemory(memory) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const res = await fetch(`${API}/api/user/memory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, memory })
    });

    return res.ok;
  } catch (err) {
    console.error('Failed to save user memory:', err);
    return false;
  }
}

/**
 * Extract user information from conversation
 * Called after each conversation to learn about the user
 */
export async function learnFromConversation(messages) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Extract potential facts about user from conversation
    const userMessages = messages.filter(m => m.role === 'user');
    const assistantMessages = messages.filter(m => m.role === 'assistant');
    
    // Simple extraction: look for patterns like "I am", "My name is", "I like", etc.
    const facts = [];
    
    userMessages.forEach(msg => {
      const text = msg.content.toLowerCase();
      
      // Name extraction
      const nameMatch = text.match(/(?:my name is|i'm|i am|call me)\s+([a-z]+)/i);
      if (nameMatch) {
        facts.push({ type: 'name', value: nameMatch[1] });
      }
      
      // Preferences
      const likeMatch = text.match(/(?:i like|i love|i enjoy|i prefer)\s+([^.!?]+)/i);
      if (likeMatch) {
        facts.push({ type: 'preference', value: likeMatch[1].trim() });
      }
      
      // Location
      const locationMatch = text.match(/(?:i live in|i'm from|i'm in|located in)\s+([^.!?]+)/i);
      if (locationMatch) {
        facts.push({ type: 'location', value: locationMatch[1].trim() });
      }
    });

    if (facts.length > 0) {
      // Get existing memory
      const existingMemory = await getUserMemory() || {};
      
      // Merge new facts
      const updatedMemory = { ...existingMemory };
      
      facts.forEach(fact => {
        if (fact.type === 'name' && !updatedMemory.name) {
          updatedMemory.name = fact.value;
        } else if (fact.type === 'preference') {
          if (!updatedMemory.preferences) updatedMemory.preferences = [];
          if (!updatedMemory.preferences.includes(fact.value)) {
            updatedMemory.preferences.push(fact.value);
          }
        } else if (fact.type === 'location' && !updatedMemory.location) {
          updatedMemory.location = fact.value;
        }
      });
      
      // Save updated memory
      await saveUserMemory(updatedMemory);
    }
  } catch (err) {
    console.error('Failed to learn from conversation:', err);
  }
}

/**
 * Format memory for AI system prompt
 */
export function formatMemoryForPrompt(memory) {
  if (!memory || Object.keys(memory).length === 0) {
    return "";
  }

  let prompt = "\n\nUSER CONTEXT (Remember these details):\n";
  
  if (memory.name) {
    prompt += `- User's name: ${memory.name}\n`;
  }
  
  if (memory.location) {
    prompt += `- User's location: ${memory.location}\n`;
  }
  
  if (memory.preferences && memory.preferences.length > 0) {
    prompt += `- User's preferences: ${memory.preferences.join(", ")}\n`;
  }
  
  if (memory.facts && memory.facts.length > 0) {
    prompt += `- Additional facts: ${memory.facts.join(", ")}\n`;
  }
  
  prompt += "\nUse this information to personalize your responses naturally. Don't be robotic about it.";
  
  return prompt;
}
