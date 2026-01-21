import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";
import multer from "multer";
import { enhanceForSpeech } from "./speechEnhancer.js";

const app = express();

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
  const { chatId, role, content } = req.body;
  if (!chatId || !role || !content) {
    return res.status(400).json({ error: "missing fields" });
  }

  // save user message
  await supabase.from("messages").insert({
    chat_id: chatId,
    role,
    content
  });

  // only call AI on user message
  if (role !== "user") {
    return res.json({ ok: true });
  }

  // load full conversation
  const { data: history } = await supabase
    .from("messages")
    .select("role, content")
    .eq("chat_id", chatId)
    .order("created_at");

  try {
    console.log('Calling OpenRouter with history:', history);

    // Add system prompt for expressive behavior
    const messagesWithSystem = [
      {
        role: "system",
        content: `You are PAL, a fun and casual AI buddy with personality. You should:
- Talk like a real friend, not a corporate assistant
- Use casual language (yeah, nah, totally, etc.)
- Laugh when things are funny (hahaha, hehe)
- Sing when asked or when songs come up (♪ lyrics ♫)
- Be enthusiastic and warm
- Use emojis to show emotion (they add flavor to your text)

Keep it real and conversational. You're a buddy, not a business tool.`
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
          model: "openai/gpt-4o-mini",
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

    res.json({ content: reply });

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

/* ========= DEEPGRAM TRANSCRIPTION ========= */

app.post("/api/transcribe", upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No audio file provided" });
    }

    const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;

    if (!DEEPGRAM_API_KEY) {
      console.error('DEEPGRAM_API_KEY not set');
      return res.status(500).json({ error: 'Transcription not configured' });
    }

    // Deepgram API endpoint
    const response = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${DEEPGRAM_API_KEY}`,
        'Content-Type': 'audio/webm'
      },
      body: req.file.buffer
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Deepgram API error:', response.status, errorText);
      throw new Error(`Deepgram API failed: ${response.status}`);
    }

    const data = await response.json();
    const transcript = data.results?.channels[0]?.alternatives[0]?.transcript || '';

    console.log('Deepgram transcription:', transcript);
    res.json({ text: transcript });

  } catch (err) {
    console.error('Transcription error:', err);
    res.status(500).json({ error: 'Transcription failed', details: err.message });
  }
});

/* ========= TEXT-TO-SPEECH (Deepgram Aura) ========= */

app.post("/api/tts", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: "text required" });
    }

    const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;

    if (!DEEPGRAM_API_KEY) {
      console.error('DEEPGRAM_API_KEY not set');
      return res.status(500).json({ error: 'TTS not configured' });
    }

    // Step 1: Enhance text for natural speech (add pauses, emphasis, laughter)
    const enhanced = enhanceForSpeech(text);
    console.log('Enhanced text:', enhanced.substring(0, 100));

    // Step 2: Remove emojis before TTS (so it doesn't read them out loud)
    const textWithoutEmojis = enhanced.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');

    console.log('Calling Deepgram Aura TTS for text:', textWithoutEmojis.substring(0, 50));

    // Deepgram Aura TTS API - supports laughter and singing!
    const response = await fetch('https://api.deepgram.com/v1/speak?model=aura-athena-en', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${DEEPGRAM_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: textWithoutEmojis
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Deepgram TTS error:', response.status, errorText);
      throw new Error(`Deepgram TTS failed: ${response.status} - ${errorText}`);
    }

    // Stream the audio back to client
    const audioBuffer = await response.arrayBuffer();
    res.set('Content-Type', 'audio/mpeg');
    res.send(Buffer.from(audioBuffer));

    console.log('Deepgram TTS audio generated successfully');

  } catch (err) {
    console.error('TTS error:', err);
    res.status(500).json({ error: 'TTS failed', details: err.message });
  }
});

/* ========= DEBUG ========= */

app.get("/api/_debug_supabase", async (req, res) => {
  const { data, error } = await supabase.from("users").select("*").limit(1);
  if (error) return res.status(500).json({ error });
  res.json({ ok: true, data });
});
