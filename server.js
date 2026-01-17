import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// serve static frontend + assets
app.use(express.static(__dirname));

// expose config (replace Vercel API)
app.get("/api/config", async (req, res) => {
  try {
    res.json({
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
      apiEndpoint: process.env.API_ENDPOINT || ""
    });
  } catch (err) {
    res.status(500).json({ error: "config load failed" });
  }
});

// SPA fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`server running on port ${PORT}`);
});
