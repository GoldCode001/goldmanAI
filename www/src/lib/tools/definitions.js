/**
 * Tool Definitions
 * Defines all tools/functions available to the AI
 *
 * Format follows Gemini Function Calling spec:
 * https://ai.google.dev/gemini-api/docs/function-calling
 */

/**
 * All available tools for the AI
 * Each tool has:
 * - name: Unique identifier
 * - description: What it does (shown to AI)
 * - parameters: JSON Schema for inputs
 * - permission: Required permission to use
 * - handler: String reference to executor function
 */
export const TOOL_DEFINITIONS = {
  // ============ MEMORY TOOLS ============
  remember_fact: {
    name: 'remember_fact',
    description: 'Store an important fact about the user for long-term memory. Use this when the user tells you something important about themselves, their preferences, or asks you to remember something.',
    parameters: {
      type: 'object',
      properties: {
        fact: {
          type: 'string',
          description: 'The fact to remember (e.g., "User is allergic to shellfish", "User prefers dark mode")'
        },
        category: {
          type: 'string',
          enum: ['personal', 'preference', 'health', 'work', 'family', 'other'],
          description: 'Category of the fact'
        }
      },
      required: ['fact']
    },
    permission: 'memory_write',
    handler: 'executeRememberFact'
  },

  recall_facts: {
    name: 'recall_facts',
    description: 'Retrieve stored facts about the user. Use this to recall what you know about them.',
    parameters: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['personal', 'preference', 'health', 'work', 'family', 'other', 'all'],
          description: 'Filter by category, or "all" for everything'
        }
      }
    },
    permission: 'memory_read',
    handler: 'executeRecallFacts'
  },

  // ============ GOALS & HABITS ============
  create_goal: {
    name: 'create_goal',
    description: 'Create a new goal for the user to track. Use when user expresses a goal or aspiration.',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Short title for the goal'
        },
        description: {
          type: 'string',
          description: 'Detailed description of the goal'
        },
        target_date: {
          type: 'string',
          description: 'Target completion date (ISO format, optional)'
        }
      },
      required: ['title']
    },
    permission: 'goals_write',
    handler: 'executeCreateGoal'
  },

  update_goal: {
    name: 'update_goal',
    description: 'Update progress on a goal or mark it complete.',
    parameters: {
      type: 'object',
      properties: {
        goal_id: {
          type: 'string',
          description: 'ID of the goal to update'
        },
        status: {
          type: 'string',
          enum: ['active', 'completed', 'paused', 'abandoned'],
          description: 'New status'
        },
        progress_note: {
          type: 'string',
          description: 'Note about progress made'
        }
      },
      required: ['goal_id']
    },
    permission: 'goals_write',
    handler: 'executeUpdateGoal'
  },

  get_goals: {
    name: 'get_goals',
    description: 'Get the user\'s current goals.',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['active', 'completed', 'all'],
          description: 'Filter by status'
        }
      }
    },
    permission: 'goals_read',
    handler: 'executeGetGoals'
  },

  create_habit: {
    name: 'create_habit',
    description: 'Create a new habit to track. Use when user wants to build a routine.',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Short title for the habit (e.g., "Drink water", "Meditate")'
        },
        frequency: {
          type: 'string',
          enum: ['daily', 'weekly', 'weekdays', 'custom'],
          description: 'How often the habit should be done'
        },
        reminder_time: {
          type: 'string',
          description: 'Time for reminder (HH:MM format, optional)'
        }
      },
      required: ['title']
    },
    permission: 'habits_write',
    handler: 'executeCreateHabit'
  },

  log_habit: {
    name: 'log_habit',
    description: 'Log completion of a habit. Updates streak.',
    parameters: {
      type: 'object',
      properties: {
        habit_id: {
          type: 'string',
          description: 'ID of the habit'
        },
        completed: {
          type: 'boolean',
          description: 'Whether the habit was completed'
        },
        note: {
          type: 'string',
          description: 'Optional note about the completion'
        }
      },
      required: ['habit_id', 'completed']
    },
    permission: 'habits_write',
    handler: 'executeLogHabit'
  },

  get_habits: {
    name: 'get_habits',
    description: 'Get the user\'s habits with current streaks.',
    parameters: {
      type: 'object',
      properties: {}
    },
    permission: 'habits_read',
    handler: 'executeGetHabits'
  },

  // ============ REMINDERS & TIMERS ============
  set_reminder: {
    name: 'set_reminder',
    description: 'Set a reminder for the user. Use when they ask to be reminded about something.',
    parameters: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'What to remind the user about'
        },
        time: {
          type: 'string',
          description: 'When to remind (ISO datetime or relative like "in 30 minutes", "tomorrow at 9am")'
        }
      },
      required: ['message', 'time']
    },
    permission: 'reminders',
    handler: 'executeSetReminder'
  },

  set_timer: {
    name: 'set_timer',
    description: 'Set a countdown timer.',
    parameters: {
      type: 'object',
      properties: {
        duration: {
          type: 'string',
          description: 'Duration (e.g., "5 minutes", "1 hour 30 minutes")'
        },
        label: {
          type: 'string',
          description: 'Optional label for the timer'
        }
      },
      required: ['duration']
    },
    permission: 'timers',
    handler: 'executeSetTimer'
  },

  // ============ INFORMATION TOOLS ============
  web_search: {
    name: 'web_search',
    description: 'Search the web for current information. Use for questions about recent events, facts you\'re unsure about, or anything requiring up-to-date info.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query'
        }
      },
      required: ['query']
    },
    permission: 'web_search',
    handler: 'executeWebSearch'
  },

  get_weather: {
    name: 'get_weather',
    description: 'Get current weather information.',
    parameters: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'City name or "current" to use device location'
        }
      },
      required: ['location']
    },
    permission: 'weather',
    handler: 'executeGetWeather'
  },

  get_datetime: {
    name: 'get_datetime',
    description: 'Get current date and time information.',
    parameters: {
      type: 'object',
      properties: {
        timezone: {
          type: 'string',
          description: 'Timezone (e.g., "America/New_York") or "local" for device timezone'
        },
        format: {
          type: 'string',
          enum: ['full', 'date', 'time'],
          description: 'What to return'
        }
      }
    },
    permission: 'datetime',
    handler: 'executeGetDateTime'
  },

  calculate: {
    name: 'calculate',
    description: 'Perform mathematical calculations.',
    parameters: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: 'Math expression to evaluate (e.g., "15% of 250", "sqrt(144)", "2^10")'
        }
      },
      required: ['expression']
    },
    permission: 'calculations',
    handler: 'executeCalculate'
  },

  // ============ DEVICE TOOLS ============
  get_location: {
    name: 'get_location',
    description: 'Get the user\'s current location.',
    parameters: {
      type: 'object',
      properties: {
        precision: {
          type: 'string',
          enum: ['high', 'low'],
          description: 'Location precision (high uses more battery)'
        }
      }
    },
    permission: 'location',
    handler: 'executeGetLocation'
  },

  send_notification: {
    name: 'send_notification',
    description: 'Send a notification to the user\'s device.',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Notification title'
        },
        body: {
          type: 'string',
          description: 'Notification message'
        }
      },
      required: ['title', 'body']
    },
    permission: 'notifications',
    handler: 'executeSendNotification'
  },

  copy_to_clipboard: {
    name: 'copy_to_clipboard',
    description: 'Copy text to the user\'s clipboard.',
    parameters: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Text to copy'
        }
      },
      required: ['text']
    },
    permission: 'clipboard_write',
    handler: 'executeCopyToClipboard'
  },

  // ============ CALENDAR TOOLS ============
  create_calendar_event: {
    name: 'create_calendar_event',
    description: 'Create a calendar event. Use when user wants to schedule something.',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Event title'
        },
        start_time: {
          type: 'string',
          description: 'Start time (ISO datetime or natural language like "tomorrow at 3pm")'
        },
        end_time: {
          type: 'string',
          description: 'End time (ISO datetime or natural language). If not provided, defaults to 1 hour after start.'
        },
        location: {
          type: 'string',
          description: 'Event location (optional)'
        },
        notes: {
          type: 'string',
          description: 'Event notes/description (optional)'
        }
      },
      required: ['title', 'start_time']
    },
    permission: 'calendar_write',
    handler: 'executeCreateCalendarEvent'
  },

  get_calendar_events: {
    name: 'get_calendar_events',
    description: 'Get upcoming calendar events.',
    parameters: {
      type: 'object',
      properties: {
        days_ahead: {
          type: 'number',
          description: 'Number of days to look ahead (default 7)'
        }
      }
    },
    permission: 'calendar_read',
    handler: 'executeGetCalendarEvents'
  },

  // ============ CONTACTS TOOLS ============
  search_contacts: {
    name: 'search_contacts',
    description: 'Search user\'s contacts by name.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Name to search for'
        }
      },
      required: ['query']
    },
    permission: 'contacts_read',
    handler: 'executeSearchContacts'
  },

  get_contact: {
    name: 'get_contact',
    description: 'Get full details of a specific contact.',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Contact name to look up'
        }
      },
      required: ['name']
    },
    permission: 'contacts_read',
    handler: 'executeGetContact'
  },

  // ============ FILE TOOLS ============
  save_note: {
    name: 'save_note',
    description: 'Save a note or text to a file. Use when user wants to save something for later.',
    parameters: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Name for the file (without extension)'
        },
        content: {
          type: 'string',
          description: 'Content to save'
        }
      },
      required: ['filename', 'content']
    },
    permission: 'filesystem_write',
    handler: 'executeSaveNote'
  },

  read_note: {
    name: 'read_note',
    description: 'Read a previously saved note.',
    parameters: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Name of the file to read'
        }
      },
      required: ['filename']
    },
    permission: 'filesystem_read',
    handler: 'executeReadNote'
  },

  list_notes: {
    name: 'list_notes',
    description: 'List all saved notes.',
    parameters: {
      type: 'object',
      properties: {}
    },
    permission: 'filesystem_read',
    handler: 'executeListNotes'
  },
};

/**
 * Get tool definitions formatted for Gemini function calling
 */
export function getGeminiTools() {
  return Object.values(TOOL_DEFINITIONS).map(tool => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters
  }));
}

/**
 * Get a specific tool definition by name
 */
export function getToolByName(name) {
  return TOOL_DEFINITIONS[name] || null;
}

/**
 * Get all tool names
 */
export function getToolNames() {
  return Object.keys(TOOL_DEFINITIONS);
}
