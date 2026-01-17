import express from "express";
import fetch from "node-fetch";

const router = express.Router();

router.post("/chat", async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages) {
      return res.status(400).json({ error: "messages required" });
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://yourapp.com",
        "X-Title": "goldmanAI"
      },
      body: JSON.stringify({
        model: "openai/gpt-3.5-turbo",
        messages
      })
    });

    const data = await response.json();

    const content = data?.choices?.[0]?.message?.content ?? "";

    res.json({ content });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "chat failed" });
  }
});

export default router;
