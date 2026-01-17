# ai assistant - full setup guide

## project structure

```
ai-assistant-full/
├── index.html              # main html file
├── src/
│   ├── styles/
│   │   └── main.css       # all styles
│   ├── lib/
│   │   ├── supabase.js    # supabase client
│   │   ├── auth.js        # authentication
│   │   ├── database.js    # database operations
│   │   ├── chat.js        # chat functionality
│   │   └── app.js         # main app logic
│   └── components/
│       └── ui.js          # ui interactions
├── supabase/
│   └── schema.sql         # database schema
└── README.md              # this file
```

## features

✅ **authentication** - email/password with supabase auth
✅ **persistent storage** - all chats saved to supabase
✅ **chat history** - load previous conversations
✅ **file uploads** - images and documents (stored as base64)
✅ **multi-model support** - gpt-4, claude, gemini, deepseek
✅ **user settings** - preferences saved per user
✅ **export functionality** - download all your chats
✅ **responsive design** - works on mobile and desktop

## setup instructions

### 1. setup supabase

1. go to [supabase.com](https://supabase.com) and create account
2. create a new project
3. wait 2-3 minutes for setup

### 2. create database tables

1. in your supabase project, go to **sql editor**
2. copy the contents of `supabase/schema.sql`
3. paste and run it
4. this creates all necessary tables and security policies

### 3. get supabase credentials

1. go to **settings** > **api**
2. copy these values:
   - **project url** (example: `https://xxxxx.supabase.co`)
   - **anon public key** (the `anon` key)

### 4. deploy backend api to railway

you already have this done:
- url: `https://free-gpt4-web-api-production.up.railway.app`

if you need to redeploy:
```bash
# in the Free-GPT4-WEB-API repo
railway login
railway link
railway up
```

### 5. deploy frontend to vercel

**option a: drag and drop (easiest)**
1. go to [vercel.com](https://vercel.com)
2. click "add new" > "project"
3. drag the entire `ai-assistant-full` folder
4. deploy!

**option b: github**
1. push this folder to github
2. connect vercel to your repo
3. auto-deploys on every push

**option c: vercel cli**
```bash
npm i -g vercel
cd ai-assistant-full
vercel
```

### 6. configure the app

when you first open your deployed app:

1. **api configuration section:**
   - railway api endpoint: `https://free-gpt4-web-api-production.up.railway.app`
   - supabase url: your project url
   - supabase anon key: your anon key
   - click "save config"

2. **create account:**
   - click "sign up" tab
   - enter email and password
   - check your email for verification link
   - verify email
   - sign in

3. **start chatting!**

## usage

### creating chats

- click "new chat" to start a conversation
- first message becomes the chat title
- all messages are saved automatically

### uploading files

- click 📎 to attach files
- supports: images, pdf, txt, doc, md, json, csv
- images are embedded in messages
- text files are sent to ai for analysis

### switching models

- use sidebar to change ai model
- supports: gpt-4, gpt-4o, claude-sonnet, gemini-pro, deepseek-r1
- change provider for different routing

### managing chats

- click any chat in history to load it
- click 🗑️ to delete current chat
- click "export all" to download all chats as json

## architecture

```
┌─────────────────────────────────────┐
│         user browser                │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│    frontend (vercel)                │
│    - auth ui                        │
│    - chat interface                 │
│    - file handling                  │
└───────┬──────────────────┬──────────┘
        │                  │
        ▼                  ▼
┌────────────────┐  ┌──────────────────┐
│   supabase     │  │  railway api     │
│   - auth       │  │  - ai routing    │
│   - database   │  │  - model access  │
│   - storage    │  └──────────────────┘
└────────────────┘
```

## database schema

**chats table:**
- id (uuid)
- user_id (uuid)
- title (text)
- created_at (timestamp)
- updated_at (timestamp)

**messages table:**
- id (uuid)
- chat_id (uuid)
- role (text: user/assistant/system)
- content (text)
- files (jsonb)
- created_at (timestamp)

**user_settings table:**
- user_id (uuid)
- settings (jsonb)
- updated_at (timestamp)

## security

- **row level security (rls)** enabled on all tables
- users can only access their own data
- authentication required for all operations
- anon key is safe to use in frontend
- never expose service_role key

## costs

- **supabase:** free tier (500mb db, 1gb storage, 50k monthly active users)
- **railway:** $5/month credit
- **vercel:** free forever for personal projects
- **total:** essentially free for personal use

## troubleshooting

### "supabase not initialized"
- make sure you saved the config
- check supabase url and key are correct
- open browser console for detailed errors

### "failed to load chats"
- check if you ran the sql schema
- verify rls policies are created
- check browser console for errors

### "api not responding"
- verify railway url is correct
- test api directly: `curl "https://your-railway-url/?text=hello"`
- check railway logs for errors

### authentication issues
- make sure email is verified
- check supabase auth settings
- verify anon key permissions

## local development

to test locally:

1. open `index.html` in browser
2. configure supabase credentials
3. use `http://127.0.0.1:5500` for local api testing

or use a local server:
```bash
python -m http.server 8000
# open http://localhost:8000
```

## customization

### changing colors

edit `src/styles/main.css`:
```css
:root {
    --bg-primary: #0a0a0a;
    --bg-secondary: #1a1a1a;
    --accent: #ffffff;
    /* change these values */
}
```

### adding new models

edit `index.html`:
```html
<select id="modelSelect">
    <option value="your-model">your model</option>
</select>
```

### modifying ui

- `index.html` - structure
- `src/styles/main.css` - styling
- `src/components/ui.js` - interactions

## support

if you run into issues:
1. check browser console for errors
2. check supabase logs
3. check railway logs
4. verify all credentials are correct

## next steps

1. deploy to vercel
2. configure credentials
3. create account
4. start using your personal ai assistant!

enjoy! 🚀
