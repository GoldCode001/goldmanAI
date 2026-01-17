import express from "express"
import cors from "cors"
import fetch from "node-fetch"

const app = express()
app.use(cors())
app.use(express.json())

const PORT = process.env.PORT || 3000
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY
const FREE_GPT_URL = process.env.FREE_GPT_URL // your Railway Free-GPT URL

app.post("/api/chat", async (req, res) => {
  const { messages } = req.body

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "messages array required" })
  }

  const lastUserMessage = messages[messages.length - 1]?.content
  if (!lastUserMessage) {
    return res.status(400).json({ error: "empty message" })
  }

  try {
    // 1️⃣ try OpenRouter first
    const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages,
        temperature: 0.7
      })
    })

    if (!orRes.ok) {
      throw new Error("OpenRouter failed")
    }

    const orData = await orRes.json()
    const reply = orData.choices[0].message.content

    return res.json({
      role: "assistant",
      content: reply,
      provider: "openrouter"
    })

  } catch (err) {
    // 2️⃣ fallback to Free-GPT
    try {
      const fgRes = await fetch(
        `${FREE_GPT_URL}/?text=${encodeURIComponent(lastUserMessage)}`
      )

      const text = await fgRes.text()

      return res.json({
        role: "assistant",
        content: text,
        provider: "free-gpt"
      })
    } catch (fallbackErr) {
      return res.status(500).json({
        error: "all providers failed"
      })
    }
  }
})

app.listen(PORT, () => {
  console.log(`AI backend running on port ${PORT}`)
})
