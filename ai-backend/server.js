import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";
import multer from "multer";

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
          messages: history
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

/* ========= WHISPER TRANSCRIPTION ========= */

app.post("/api/transcribe", upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No audio file provided" });
    }

    // Create FormData for Whisper API
    const formData = new FormData();
    formData.append('file', new Blob([req.file.buffer]), 'audio.webm');
    formData.append('model', 'whisper-1');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Whisper API failed: ${response.statusText}`);
    }

    const data = await response.json();
    res.json({ text: data.text });

  } catch (err) {
    console.error('Transcription error:', err);
    res.status(500).json({ error: 'Transcription failed' });
  }
});

/* ========= TEXT-TO-SPEECH (ElevenLabs) ========= */

app.post("/api/tts", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: "text required" });
    }

    const VOICE_ID = 'pNInz6obpgDQGcFmaJgB'; // Default calm voice

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': process.env.ELEVENLABS_API_KEY
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5
        }
      })
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs API failed: ${response.statusText}`);
    }

    // Stream the audio back to client
    const audioBuffer = await response.arrayBuffer();
    res.set('Content-Type', 'audio/mpeg');
    res.send(Buffer.from(audioBuffer));

  } catch (err) {
    console.error('TTS error:', err);
    res.status(500).json({ error: 'TTS failed' });
  }
});

/* ========= DEBUG ========= */

app.get("/api/_debug_supabase", async (req, res) => {
  const { data, error } = await supabase.from("users").select("*").limit(1);
  if (error) return res.status(500).json({ error });
  res.json({ ok: true, data });
});
