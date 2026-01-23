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
 * Now includes goal and habit tracking
 */
export async function learnFromConversation(messages) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Extract potential facts about user from conversation
    const userMessages = messages.filter(m => m.role === 'user');
    
    // Simple extraction: look for patterns like "I am", "My name is", "I like", etc.
    const facts = [];
    const rememberedFacts = []; // For "remember this" / "don't forget" extraction
    const goals = []; // For goal tracking
    const habits = []; // For habit tracking
    
    userMessages.forEach(msg => {
      const text = msg.content;
      const lowerText = text.toLowerCase();
      
      // Name extraction (don't overwrite if already set)
      const nameMatch = text.match(/(?:my name is|i'm|i am|call me)\s+([a-z]+(?:\s+[a-z]+)?)/i);
      if (nameMatch) {
        facts.push({ type: 'name', value: nameMatch[1].trim() });
      }
      
      // "Remember this" / "Don't forget" extraction
      const rememberPatterns = [
        /(?:remember|don't forget|don't forget that|never forget)\s+(?:that\s+)?(.+?)(?:\.|$)/gi,
        /(?:remember this|remember that)\s*:?\s*(.+?)(?:\.|$)/gi
      ];
      
      rememberPatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          const fact = match[1].trim();
          if (fact && fact.length > 3) { // Minimum length to avoid noise
            rememberedFacts.push(fact);
          }
        }
      });
      
      // Goal extraction - patterns like "I want to", "I'm trying to", "My goal is"
      const goalPatterns = [
        /(?:i want to|i'm trying to|my goal is|i'm working on|i plan to|i aim to)\s+(.+?)(?:\.|$)/gi,
        /(?:goal|objective|target)\s*:?\s*(.+?)(?:\.|$)/gi
      ];
      
      goalPatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          const goal = match[1].trim();
          if (goal && goal.length > 5) {
            goals.push({
              text: goal,
              createdAt: new Date().toISOString(),
              status: 'active'
            });
          }
        }
      });
      
      // Habit extraction - patterns like "I'm doing X daily", "I want to build the habit of"
      const habitPatterns = [
        /(?:i'm doing|i do|i want to do|i'm building the habit of|i'm trying to)\s+(.+?)\s+(?:daily|every day|weekly|regularly|often)/gi,
        /(?:habit|routine)\s*:?\s*(.+?)(?:\.|$)/gi
      ];
      
      habitPatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          const habit = match[1].trim();
          if (habit && habit.length > 5) {
            habits.push({
              text: habit,
              createdAt: new Date().toISOString(),
              streak: 0,
              lastCompleted: null
            });
          }
        }
      });
      
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

    // Get existing memory
    const existingMemory = await getUserMemory() || {};
    const updatedMemory = { ...existingMemory };
    
    // Process extracted facts
    facts.forEach(fact => {
      if (fact.type === 'name' && !updatedMemory.name) {
        // Only set name if not already set (don't overwrite signup name)
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
    
    // Add remembered facts
    if (rememberedFacts.length > 0) {
      if (!updatedMemory.facts) updatedMemory.facts = [];
      rememberedFacts.forEach(fact => {
        if (!updatedMemory.facts.includes(fact)) {
          updatedMemory.facts.push(fact);
        }
      });
    }
    
    // Add goals
    if (goals.length > 0) {
      if (!updatedMemory.goals) updatedMemory.goals = [];
      goals.forEach(goal => {
        // Check if goal already exists (avoid duplicates)
        const exists = updatedMemory.goals.some(g => 
          g.text.toLowerCase() === goal.text.toLowerCase()
        );
        if (!exists) {
          updatedMemory.goals.push(goal);
        }
      });
    }
    
    // Add habits
    if (habits.length > 0) {
      if (!updatedMemory.habits) updatedMemory.habits = [];
      habits.forEach(habit => {
        // Check if habit already exists (avoid duplicates)
        const exists = updatedMemory.habits.some(h => 
          h.text.toLowerCase() === habit.text.toLowerCase()
        );
        if (!exists) {
          updatedMemory.habits.push(habit);
        }
      });
    }
    
    // Save updated memory if there are changes
    if (facts.length > 0 || rememberedFacts.length > 0 || goals.length > 0 || habits.length > 0) {
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
  
  // Goals tracking
  if (memory.goals && memory.goals.length > 0) {
    prompt += `\n- Active Goals:\n`;
    memory.goals.filter(g => g.status === 'active').forEach(goal => {
      prompt += `  * ${goal.text} (created: ${new Date(goal.createdAt).toLocaleDateString()})\n`;
    });
    prompt += `  Check in on these goals naturally in conversation. Celebrate progress and offer support.\n`;
  }
  
  // Habits tracking
  if (memory.habits && memory.habits.length > 0) {
    prompt += `\n- Habits Being Built:\n`;
    memory.habits.forEach(habit => {
      const streak = habit.streak || 0;
      prompt += `  * ${habit.text} (${streak}-day streak)\n`;
    });
    prompt += `  Acknowledge their consistency and encourage them to maintain their streaks.\n`;
  }
  
  prompt += "\nUse this information to personalize your responses naturally. Don't be robotic about it.";
  
  return prompt;
}
