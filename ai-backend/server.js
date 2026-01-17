import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("backend alive");
});

app.post("/api/chat", async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "messages required" });
    }

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",

          // REQUIRED by OpenRouter
          "HTTP-Referer": "https://goldmanai.app",
          "X-Title": "Goldman AI"
        },
        body: JSON.stringify({
          model: "openai/gpt-4o-mini",
          messages
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenRouter error:", data);
      return res.status(500).json({
        error: "invalid openrouter response",
        raw: data
      });
    }

    res.json({
      content: data.choices[0].message.content
    });

  } catch (err) {
    console.error("Server crash:", err);
    res.status(500).json({ error: "backend error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  
});
