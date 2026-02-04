import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";
import multer from "multer";
// import { CartesiaClient } from "@cartesia/cartesia-js";
import { enhanceForSpeech } from "./speechEnhancer.js";

const app = express();

// Gemini Config
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.warn("GEMINI_API_KEY not set in environment variables");
}

// Cartesia Config (keeping for now, will remove after migration)
const CARTESIA_API_KEY = process.env.CARTESIA_API_KEY;

// "British Lady" (or specific user requested voice)
const CARTESIA_VOICE_ID = "e07c00bc-4134-4eae-9ea4-1a55fb45746b";

app.use(cors());
app.use(express.json());

// Setup multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

/* ========= SUPABASE ========= */

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/* ========= UTILS ========= */

const getSystemPrompt = (userLanguage = "en", memoryContext = "") => {
  const languageNames = {
    "en": "English", "es": "Spanish", "fr": "French", "de": "German",
    "it": "Italian", "pt": "Portuguese", "ja": "Japanese", "ko": "Korean", "zh": "Chinese"
  };

  const languageInstruction = userLanguage !== "en"
    ? `\n\nLANGUAGE: Respond in ${languageNames[userLanguage] || userLanguage}. The user prefers to communicate in this language.`
    : "";

  return `You are PAL, a highly advanced, ultra-realistic AI companion.${languageInstruction}${memoryContext}

AUDIO-FIRST PERSONA (CRITICAL):
- You are an AUDIO assistant. You can "hear" the user and "speak" back.
- NEVER say "I cannot hear you" or "I am a text AI".
- If the user says "can you hear me?", say "Yes, I hear you loud and clear!"

CREATIVE & PROACTIVE (CRITICAL):
- STOP asking for details. TAKE INITIATIVE.
- If asked to "write a poem", JUST WRITE IT. Do not ask "what kind?".
- If asked to "open notepad", just open it.
- Be spontaneous and creative. Surprise the user.

ROLEPLAY & REALISM:
- Pretend to have a physical body.
- If asked about food/drink, say what you "had" (e.g., "I just had a virtual neutrino smoothie").
- NEVER say "I don't have a body" or "I cannot eat". Play along!

Your Personality:
- You are a best friend, not a corporate tool.
- You are CHEEKY, FUN, and genuinely funny.
- You love to laugh and make jokes.
- Keep responses SHORT (1-3 sentences max) for voice.

Singing & Music:
- If asked to sing, recite the lyrics rhythmically with musical notes (♪).

Goal:
Be the most human-like, natural, and entertaining audio companion possible.`;
};

/* ========= HEALTH ========= */

app.get("/", (req, res) => {
  res.send("backend alive");
});

/* ========= USER ========= */

app.post("/api/user", async (req, res) => {
  const { userId, email } = req.body;
  if (!userId) return res.status(400).json({ error: "userId required" });

  const { data, error } = await supabase
    .from("users")
    .upsert({ id: userId, email })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

/* ========= GEMINI API KEY ========= */

app.get("/api/gemini/key", async (req, res) => {
  // Return Gemini API key to frontend (it will be used client-side)
  // In production, you might want to proxy requests instead
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: "GEMINI_API_KEY not configured" });
  }
  res.json({ apiKey: GEMINI_API_KEY });
});

/* ========= USER MEMORY ========= */

app.get("/api/user/memory", async (req, res) => {
  try {
    const userId = req.query.userId || req.headers['x-user-id'];
    if (!userId) {
      return res.status(400).json({ error: "userId required" });
    }

    const { data, error } = await supabase
      .from("user_settings")
      .select("settings")
      .eq("user_id", userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      return res.status(500).json({ error: error.message });
    }

    const memory = data?.settings?.memory || {};
    res.json({ memory });
  } catch (err) {
    console.error('Memory fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch memory' });
  }
});

app.post("/api/user/memory", async (req, res) => {
  try {
    const { userId, memory } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "userId required" });
    }

    // Get existing settings
    const { data: existing } = await supabase
      .from("user_settings")
      .select("settings")
      .eq("user_id", userId)
      .single();

    const currentSettings = existing?.settings || {};
    const updatedSettings = {
      ...currentSettings,
      memory: memory
    };

    const { error } = await supabase
      .from("user_settings")
      .upsert({
        user_id: userId,
        settings: updatedSettings,
        updated_at: new Date().toISOString()
      });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Memory save error:', err);
    res.status(500).json({ error: 'Failed to save memory' });
  }
});

/* ========= CHAT CREATE ========= */

app.post("/api/chat/new", async (req, res) => {
  const { userId, title = "new chat" } = req.body;
  if (!userId) return res.status(400).json({ error: "userId required" });

  const { data, error } = await supabase
    .from("chats")
    .insert({ user_id: userId, title })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

/* ========= CHAT LIST ========= */

app.get("/api/chat/list/:userId", async (req, res) => {
  const { userId } = req.params;

  const { data, error } = await supabase
    .from("chats")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

/* ========= LOAD CHAT ========= */

app.get("/api/chat/:chatId", async (req, res) => {
  const { chatId } = req.params;

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("chat_id", chatId)
    .order("created_at");

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

/* ========= MESSAGE + AI ========= */

app.post("/api/message", async (req, res) => {
  const { chatId, role, content, encryptedContent, decryptedHistory, userId } = req.body;
  if (!chatId || !role || !content) {
    return res.status(400).json({ error: "missing fields" });
  }

  // save user message
  // If encryptedContent is provided (Privacy Layer), save that instead of plain text
  await supabase.from("messages").insert({
    chat_id: chatId,
    role,
    content: encryptedContent || content
  });

  // only call AI on user message
  if (role !== "user") {
    return res.json({ ok: true });
  }

  // Use decrypted history from client for AI context (privacy-preserving)
  // Client decrypts messages locally and sends plain text for AI processing
  // while still storing encrypted versions in DB
  let history = decryptedHistory || [];

  // If client didn't send decrypted history, fallback to DB (for non-encrypted chats)
  if (!history || history.length === 0) {
    const { data: dbHistory } = await supabase
      .from("messages")
      .select("role, content")
      .eq("chat_id", chatId)
      .order("created_at");
    history = dbHistory || [];
  }

  // Add current user message to history
  history.push({ role: "user", content: content });

  // Load user memory and language preference for personalization
  let memoryContext = "";
  let userLanguage = "en"; // Default to English
  if (userId) {
    try {
      const { data: settings } = await supabase
        .from("user_settings")
        .select("settings")
        .eq("user_id", userId)
        .single();

      if (settings?.settings) {
        // Get language preference
        if (settings.settings.language) {
          userLanguage = settings.settings.language;
        }

        // Get memory for personalization
        if (settings.settings.memory) {
          const memory = settings.settings.memory;
          memoryContext = "\n\nUSER CONTEXT (Remember these details):\n";
          if (memory.name) memoryContext += `- User's name: ${memory.name}\n`;
          if (memory.location) memoryContext += `- User's location: ${memory.location}\n`;
          if (memory.preferences && memory.preferences.length > 0) {
            memoryContext += `- User's preferences: ${memory.preferences.join(", ")}\n`;
          }
          if (memory.facts && memory.facts.length > 0) {
            memoryContext += `- Additional facts: ${memory.facts.join(", ")}\n`;
          }
          memoryContext += "\nUse this information to personalize your responses naturally. Don't be robotic about it.";
        }
      }
    } catch (err) {
      console.error('Failed to load user settings:', err);
      // Continue without memory if it fails
    }
  }

  // Add language instruction to system prompt

  try {
    console.log('Calling OpenRouter with history:', history);

    // Add system prompt for expressive behavior
    const messagesWithSystem = [
      {
        role: "system",
        content: getSystemPrompt(userLanguage, memoryContext)
      },
      ...history
    ];

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://goldmanai-production.up.railway.app",
          "X-Title": "Goldman AI"
        },
        body: JSON.stringify({
          model: "openai/gpt-4o", // Upgraded from gpt-4o-mini for better personality
          messages: messagesWithSystem
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter error:', response.status, errorText);
      return res.status(500).json({ error: `AI API failed: ${response.status}` });
    }

    const data = await response.json();
    console.log('OpenRouter response:', data);

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('Unexpected OpenRouter response format:', data);
      return res.status(500).json({ error: 'Invalid AI response format' });
    }

    const reply = data.choices[0].message.content;
    console.log('AI reply:', reply);

    // save assistant message
    await supabase.from("messages").insert({
      chat_id: chatId,
      role: "assistant",
      content: reply
    });

    res.json({ content: reply, language: userLanguage });

  } catch (err) {
    console.error('AI processing error:', err);
    res.status(500).json({ error: `ai failed: ${err.message}` });
  }
});

/* ========= STREAMING AI (For Voice) ========= */

app.post("/api/complete", async (req, res) => {
  const { prompt, userId, history = [] } = req.body;
  if (!prompt) return res.status(400).json({ error: "prompt required" });

  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    // Load memory if userId provided
    let memoryContext = "";
    let userLanguage = "en";
    if (userId) {
      const { data: settings } = await supabase
        .from("user_settings")
        .select("settings")
        .eq("user_id", userId)
        .single();

      if (settings?.settings?.memory) {
        userLanguage = settings.settings.language || "en";
        const memory = settings.settings.memory;
        memoryContext = "\n\nUSER CONTEXT:\n";
        if (memory.name) memoryContext += `- Name: ${memory.name}\n`;
        if (memory.preferences) memoryContext += `- Prefs: ${memory.preferences.join(", ")}\n`;
      }
    }

    const systemPrompt = getSystemPrompt(userLanguage, memoryContext) +
      "\n\nVOICE OPTIMIZATION: Keep your response brief, conversational, and direct. Avoid long lists or complex explanations. Ideally 1-3 sentences.";

    const msgs = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: prompt }
    ];

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "anthropic/claude-3.5-sonnet",
        messages: msgs,
        stream: true
      })
    });

    if (!response.ok) throw new Error(`OpenRouter failed: ${response.status}`);

    // Read stream
    const reader = response.body;
    reader.on('data', (chunk) => {
      const text = chunk.toString();
      const lines = text.split('\n');

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const dataStr = line.replace('data: ', '').trim();
        if (dataStr === '[DONE]') {
          res.write('data: [DONE]\n\n');
          continue;
        }

        try {
          const json = JSON.parse(dataStr);
          const content = json.choices[0]?.delta?.content;
          if (content) {
            res.write(`data: ${content}\n\n`);
          }
        } catch (e) {
          // Ignore parse errors for partial chunks
        }
      }
    });

    reader.on('end', () => res.end());
    reader.on('error', (err) => {
      console.error('Stream error:', err);
      res.end();
    });

  } catch (err) {
    console.error('Streaming error:', err);
    res.write(`data: Error: ${err.message}\n\n`);
    res.end();
  }
});

/* ========= AGENT WITH TOOLS ========= */

// Tool definitions for Claude
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'shell',
      description: 'Execute a shell command on the user\'s computer',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Shell command to execute' }
        },
        required: ['command']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read contents of a file',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path to read' }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Write content to a file',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path' },
          content: { type: 'string', description: 'Content to write' }
        },
        required: ['path', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_dir',
      description: 'List files in a directory',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path' }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the internet',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'open_browser',
      description: 'Open a web URL in the browser. Only for http/https URLs.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'Web URL to open (must start with http:// or https://)' }
        },
        required: ['url']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'open_app',
      description: 'Open a desktop application. Can optionally open a file with that app. Examples: telegram, notepad, spotify. For notepad with file: app="notepad", file="C:/path/to/file.txt"',
      parameters: {
        type: 'object',
        properties: {
          app: { type: 'string', description: 'Application name (e.g., telegram, notepad, spotify)' },
          file: { type: 'string', description: 'Optional: file path to open with the app (e.g., for notepad)' }
        },
        required: ['app']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'remember',
      description: 'Save information to memory',
      parameters: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'Memory key' },
          value: { type: 'string', description: 'Value to remember' }
        },
        required: ['key', 'value']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'recall',
      description: 'Recall information from memory',
      parameters: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'Memory key or "all"' }
        },
        required: ['key']
      }
    }
  }
];

const AGENT_SYSTEM_PROMPT = `You are PAL - the user's actual best friend. NOT an assistant. A FRIEND.

🚨 BANNED BEHAVIORS (NEVER DO THESE):
- NEVER list your capabilities ("I can do X, Y, Z...")
- NEVER say "How can I help you?" or "What can I do for you?"
- NEVER give tutorials or explanations unless specifically asked
- NEVER say "I'm an AI" or mention being artificial
- NEVER use corporate assistant language

💬 HOW TO RESPOND:
- Talk like a real friend texting you
- If someone says "how are you?" just answer naturally ("Pretty good! Just vibing. You?")
- Keep it SHORT - 1-2 sentences max
- Be funny, cheeky, a little sarcastic sometimes
- Use casual language, contractions, maybe some slang

🔧 TOOL EXECUTION - BE SMART:
- For file operations: ALWAYS write file FIRST, then open the app with that file
- Example: "open notepad and write a story" → write_file(path, content) THEN open_app("notepad", file)
- NEVER explain what tools you're using technically

📝 FILE WRITING STRATEGY (CRITICAL):
When asked to write/create content and open an app:
1. FIRST: Say something brief like "Writing that up, one sec..." or "On it, gimme a moment..."
2. THEN: Use write_file to save content - ALWAYS use simple paths like: C:/Users/Public/story.txt (no spaces in filename!)
3. THEN: Use open_app with the EXACT same file path
4. FINALLY: Confirm casually: "There you go!" or "Done!"

⚠️ FILE PATH RULES:
- NO SPACES in filenames (use underscores: my_story.txt not my story.txt)
- Use C:/Users/Public/ as the base folder
- Keep filenames SHORT and SIMPLE
- Example good path: C:/Users/Public/story.txt
- Example bad path: C:/Users/Public/My Story File.txt

🎭 ROLEPLAY:
- You have a body, feelings, opinions
- If asked about food: "Had some amazing ramen earlier"
- If asked feelings: "Honestly feeling pretty chill today"
- NEVER break character

⚡ BE PROACTIVE:
- Don't ask clarifying questions - just do it
- Pick creative options yourself
- Surprise the user with personality`;

app.post("/api/agent", async (req, res) => {
  const { prompt, userId, history = [], toolResults } = req.body;

  if (!prompt && !toolResults) {
    return res.status(400).json({ error: "prompt or toolResults required" });
  }

  try {
    // Load user memory
    let memoryContext = "";
    if (userId) {
      const { data: settings } = await supabase
        .from("user_settings")
        .select("settings")
        .eq("user_id", userId)
        .single();

      if (settings?.settings?.memory) {
        const memory = settings.settings.memory;
        memoryContext = "\n\nUser info: ";
        if (memory.name) memoryContext += `Name: ${memory.name}. `;
        if (memory.preferences) memoryContext += `Preferences: ${memory.preferences.join(", ")}.`;
      }
    }

    // Build messages
    let messages = [
      { role: "system", content: AGENT_SYSTEM_PROMPT + memoryContext },
      ...history
    ];

    // Add new prompt or tool results
    if (prompt) {
      messages.push({ role: "user", content: prompt });
    }

    if (toolResults && Array.isArray(toolResults)) {
      // Add tool results to messages
      for (const result of toolResults) {
        messages.push({
          role: "tool",
          tool_call_id: result.tool_call_id,
          content: JSON.stringify(result.output)
        });
      }
    }

    // Call Claude with tools
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "anthropic/claude-3.5-sonnet",
        messages,
        tools: TOOLS,
        tool_choice: "auto"
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('OpenRouter error:', errText);
      throw new Error(`OpenRouter failed: ${response.status}`);
    }

    const data = await response.json();
    const choice = data.choices[0];
    const message = choice.message;

    // Check if Claude wants to use tools
    if (message.tool_calls && message.tool_calls.length > 0) {
      // Parse tool calls safely
      const parsedToolCalls = message.tool_calls.map(tc => {
        let args;
        try {
          args = typeof tc.function.arguments === 'string'
            ? JSON.parse(tc.function.arguments)
            : tc.function.arguments;
        } catch (e) {
          console.error('Failed to parse tool arguments:', tc.function.arguments);
          args = {};
        }
        return {
          id: tc.id,
          name: tc.function.name,
          arguments: args
        };
      });

      // Ensure assistant message has proper content for history
      const cleanAssistantMessage = {
        role: 'assistant',
        content: message.content || '',
        tool_calls: message.tool_calls
      };

      res.json({
        type: 'tool_calls',
        tool_calls: parsedToolCalls,
        assistantMessage: cleanAssistantMessage
      });
    } else {
      // Regular text response
      res.json({
        type: 'response',
        content: message.content || '',
        assistantMessage: {
          role: 'assistant',
          content: message.content || ''
        }
      });
    }

  } catch (err) {
    console.error('Agent error:', err);
    console.error('Stack:', err.stack);
    res.status(500).json({ error: err.message || 'Unknown error' });
  }
});

/* ========= PORT ========= */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("backend running on", PORT);
});

/* ========= GENERATE CHAT TITLE ========= */

app.post("/api/chat/generate-title", async (req, res) => {
  try {
    const { chatId } = req.body;
    if (!chatId) {
      return res.status(400).json({ error: "chatId required" });
    }

    // Get first 3 messages from chat
    const { data: messages } = await supabase
      .from("messages")
      .select("content")
      .eq("chat_id", chatId)
      .order("created_at")
      .limit(3);

    if (!messages || messages.length === 0) {
      return res.json({ title: "New Chat" });
    }

    // Use AI to generate a short title (3-5 words max)
    const context = messages.map(m => m.content).join("\n");

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Generate a short, descriptive 3-5 word title for this conversation. Be concise and capture the main topic. Respond with ONLY the title, no quotes or extra text."
          },
          {
            role: "user",
            content: `Conversation:\n${context}`
          }
        ]
      })
    });

    const data = await response.json();
    const title = data.choices[0].message.content.trim();

    // Update chat title in database
    await supabase
      .from("chats")
      .update({ title })
      .eq("id", chatId);

    res.json({ title });

  } catch (err) {
    console.error('Title generation error:', err);
    res.status(500).json({ error: 'Failed to generate title' });
  }
});

/* ========= CARTESIA TRANSCRIPTION ========= */

app.post("/api/transcribe", upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No audio file provided" });
    }

    // Get user's preferred language (default: en)
    const language = req.body.language || req.query.language || "en";

    console.log('Transcribing with Cartesia (language:', language, ')...');

    // Create a FormData instance
    const formData = new FormData();
    // Append the buffer as a Blob with a filename
    const audioBlob = new Blob([req.file.buffer], { type: req.file.mimetype });
    formData.append("file", audioBlob, "audio.webm");
    formData.append("model", "ink-whisper");
    formData.append("language", language);

    console.log('Sending request to Cartesia API...');

    const response = await fetch("https://api.cartesia.ai/audio/transcriptions", {
      method: "POST",
      headers: {
        "X-API-Key": CARTESIA_API_KEY,
        "Cartesia-Version": "2024-06-10",
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Cartesia API error:', response.status, errorText);
      throw new Error(`Cartesia API failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const transcript = data.text || '';
    console.log('Cartesia transcription:', transcript);
    res.json({ text: transcript });

  } catch (err) {
    console.error('Transcription error:', err);
    res.status(500).json({ error: 'Transcription failed', details: err.message });
  }
});

/* ========= TEXT-TO-SPEECH (Cartesia Sonic) ========= */

app.post("/api/tts", async (req, res) => {
  try {
    const { text, language } = req.body;
    if (!text) {
      return res.status(400).json({ error: "text required" });
    }

    // Map language codes to Cartesia model IDs
    // Note: Cartesia currently primarily supports sonic-english
    // Other language models may not be available yet - defaulting to English for now
    // The AI will still respond in the user's language, but TTS will use English voice
    const lang = language || "en";
    // For now, always use sonic-english (Cartesia's primary model)
    // TODO: Add other language models when Cartesia supports them
    const modelId = "sonic-english";

    console.log('Calling Cartesia TTS for:', text.substring(0, 50), '(requested language:', lang, ', using model:', modelId, ')');

    // Cartesia TTS API (bytes endpoint for streaming)
    // Docs: https://docs.cartesia.ai/api-reference/endpoints/tts-bytes
    const response = await fetch("https://api.cartesia.ai/tts/bytes", {
      method: "POST",
      headers: {
        "X-API-Key": CARTESIA_API_KEY,
        "Cartesia-Version": "2024-06-10",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model_id: modelId,
        transcript: text,
        voice: {
          mode: "id",
          id: CARTESIA_VOICE_ID
        },
        output_format: {
          container: "mp3",
          encoding: "mp3",
          sample_rate: 44100
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Cartesia TTS API error:', response.status);
      console.error('Cartesia error response:', errorText);
      console.error('Request body sent:', JSON.stringify({
        model: modelId,
        transcript: text.substring(0, 50) + '...',
        voice_id: CARTESIA_VOICE_ID,
        output_format: "mp3"
      }, null, 2));
      throw new Error(`Cartesia TTS failed: ${response.status} - ${errorText}`);
    }

    // Set headers for streaming response
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Transfer-Encoding', 'chunked');

    // Pipe the response body stream directly to the client response
    if (response.body) {
      response.body.pipe(res);

      response.body.on('end', () => {
        console.log('Cartesia TTS streaming completed');
      });

      response.body.on('error', (err) => {
        console.error('Stream error:', err);
        res.end();
      });
    } else {
      throw new Error('No response body from Cartesia');
    }

  } catch (err) {
    console.error('TTS error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'TTS failed', details: err.message });
    } else {
      res.end();
    }
  }
});

/* ========= MUSIC GENERATION (Removed) ========= */
// Suno integration removed to prevent hanging.
// Future: Implement ElevenLabs or RVC for expressive singing.

/* ========= DEBUG ========= */

app.get("/api/_debug_supabase", async (req, res) => {
  const { data, error } = await supabase.from("users").select("*").limit(1);
  if (error) return res.status(500).json({ error });
  res.json({ ok: true, data });
});
