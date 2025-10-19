# 🤖AI Agent with Weekly Summary Feature

![npm i agents command](./assets/npm-agents-banner.svg)

A Cloudflare AI-powered chat agent built on [agents-starter](https://github.com/cloudflare/agents-starter), enhanced with automated weekly conversation summaries sent via email.

## 🌟 What's New

**Weekly AI Summary Feature:**

- Analyzes your entire week's conversations automatically
- Generates personalized insights and recommendations
- Sends email every Sunday evening
- Configure via simple chat commands

## 🚀 Quick Start

### Prerequisites

- Cloudflare account
- OpenAI API key
- Mailgun account (free tier)

### Setup

1. **Install**

```bash
   npm install
```

1. **Configure environment** (`.dev.vars`)

```bash
   OPENAI_API_KEY=sk-your-key
   MAILGUN_API_KEY=your-mailgun-key
   MAILGUN_DOMAIN=your-domain.mailgun.org
   MAILGUN_FROM_EMAIL=ai@your-domain.com
```

1. **Create KV namespace**

```bash
   wrangler kv:namespace create "USER_CONFIG"
   wrangler kv:namespace create "USER_CONFIG" --preview
```

Update IDs in `wrangler.jsonc`

1. **Deploy**

````bash
   wrangler secret bulk .dev.vars
   npm run deploy
```

## 📖 Usage

### Enable Weekly Summaries

In the chat interface:
```
Please set up weekly summaries and send them to my-email@example.com
```

### Test Immediately
```
Generate a summary of my last 7 days
```

### Disable
```
Please disable my weekly summaries
````

## 📧 Email Content

Your weekly summary includes:

- **Highlights**: Main topics discussed
- **Insights**: Conversation patterns and trends
- **Recommendations**: 3-5 actionable suggestions
- **Goals**: Tasks mentioned during the week

## ⚙️ Customization

**Change schedule** (in `wrangler.jsonc`):

````jsonc
"triggers": {
  "crons": ["0 20 * * 0"]  // Sunday 8PM UTC
}
```

## 🏗️ Tech Stack

- **Runtime**: Cloudflare Workers
- **AI**: OpenAI GPT-4o
- **Storage**: Durable Objects (SQLite) + KV
- **Email**: Mailgun API
- **Scheduling**: Cron Triggers

## 📁 Key Files
```
src/
├── server.ts           # Main Worker + Chat DO
├── tools.ts            # AI tools (config summary)
├── weekly-summary.ts   # Summary generation logic
└── app.tsx             # React UI
````

## 📄 License

MIT

---

Built on [Cloudflare agents-starter](https://github.com/cloudflare/agents-starter) | Powered by [Vercel AI SDK](https://sdk.vercel.ai/)
