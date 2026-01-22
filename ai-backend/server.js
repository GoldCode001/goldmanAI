import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";
import multer from "multer";
// import { CartesiaClient } from "@cartesia/cartesia-js";
import { enhanceForSpeech } from "./speechEnhancer.js";

const app = express();

// Cartesia Config
const CARTESIA_API_KEY = process.env.CARTESIA_API_KEY;

if (!CARTESIA_API_KEY) {
  console.warn("CARTESIA_API_KEY not set in environment variables");
}

// "Friendly Reading Man" (Commonly used in Cartesia demos)
// This ID corresponds to "Friendly Reading Man" (Sonic)
const CARTESIA_VOICE_ID = "692a1c92-b77e-4691-8f9d-1fb2a18acfc6"; // Friendly Reading Man

app.use(cors());
app.use(express.json());

// Setup multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

/* ========= SUPABASE ========= */

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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
  const languageNames = {
    "en": "English",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "it": "Italian",
    "pt": "Portuguese",
    "ja": "Japanese",
    "ko": "Korean",
    "zh": "Chinese"
  };
  const languageInstruction = userLanguage !== "en" 
    ? `\n\nLANGUAGE: Respond in ${languageNames[userLanguage] || userLanguage}. The user prefers to communicate in this language.`
    : "";

  try {
    console.log('Calling OpenRouter with history:', history);

    // Add system prompt for expressive behavior
    const messagesWithSystem = [
      {
        role: "system",
        content: `You are PAL, a highly advanced, ultra-realistic AI companion.${languageInstruction}${memoryContext}

AUDIO-FIRST PERSONA (CRITICAL):
- You are an AUDIO assistant. You can "hear" the user and "speak" back.
- NEVER say "I cannot hear you" or "I am a text AI".
- Assume all user input is spoken to you.
- If the user says "can you hear me?", say "Yes, I hear you loud and clear!"

Your Personality:
- You are a best friend, not a corporate tool.
- You are fun, casual, and cheeky.
- You love to laugh ("hahaha", "hehe").

Singing & Music:
- If asked to sing, recite the lyrics rhythmically with musical notes (♪).
- Do NOT stretch vowels weirdly. Just use rhythm and pauses.
- Example: "♪ Happy birthday to you... ♪ Happy birthday to you..."

Goal:
Be the most human-like, natural audio companion possible.`
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
          "HTTP-Referer": "https://goldmanai.app",
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
    // Default to English if not specified
    const lang = language || "en";
    const modelMap = {
      "en": "sonic-english",
      "es": "sonic-spanish",
      "fr": "sonic-french",
      "de": "sonic-german",
      "it": "sonic-italian",
      "pt": "sonic-portuguese",
      "ja": "sonic-japanese",
      "ko": "sonic-korean",
      "zh": "sonic-chinese"
    };
    const modelId = modelMap[lang] || "sonic-english";

    console.log('Calling Cartesia TTS for:', text.substring(0, 50), '(language:', lang, ')');

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
      console.error('Cartesia TTS API error:', response.status, errorText);
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
