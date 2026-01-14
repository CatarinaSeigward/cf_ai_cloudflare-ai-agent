# Cloudflare AI Agent with Weekly Summary

A production-ready AI chat agent built on Cloudflare Workers, featuring automated weekly conversation analysis and email summaries.

## Features

### Core Capabilities

- **AI-Powered Chat Interface**: Interactive conversations with GPT-4o through a modern React UI
- **Persistent Storage**: Conversation history stored in Cloudflare Durable Objects with SQLite
- **Tool Integration**: Extensible tool system for weather queries, task scheduling, and custom actions
- **Human-in-the-Loop**: Configurable confirmation flow for sensitive operations

### Weekly Summary System

- **Automated Analysis**: Processes all conversations from the past 7 days
- **AI-Generated Insights**: Identifies patterns, key topics, and actionable recommendations
- **Email Delivery**: Sends formatted HTML emails via Mailgun on a configurable schedule
- **Per-User Configuration**: Each user can enable/disable and customize their summary preferences
- **Instant Preview**: Generate and preview summaries on-demand for testing

## Architecture

**Runtime**: Cloudflare Workers (Edge computing)
**AI Model**: OpenAI GPT-4o-2024-11-20
**Storage**: Durable Objects (SQLite) + Workers KV
**Email**: Mailgun API
**Frontend**: React 19 + Vite + Tailwind CSS
**Scheduling**: Cloudflare Cron Triggers

## Deployment

### Prerequisites

1. **Cloudflare Account**
   - Workers Paid plan (required for Durable Objects)
   - Access to KV and Cron Triggers

2. **API Keys**
   - OpenAI API key (https://platform.openai.com/api-keys)
   - Mailgun account and API key (https://www.mailgun.com/)

3. **Development Tools**
   - Node.js 18+ and npm
   - Wrangler CLI (`npm install -g wrangler`)

### Step 1: Clone and Install

```bash
git clone <your-repo-url>
cd cloudflare-ai-agent
npm install
```

### Step 2: Configure Environment Variables

Create a `.dev.vars` file in the project root:

```bash
# Required: OpenAI API Key
OPENAI_API_KEY=sk-proj-your-openai-api-key

# Required for email summaries: Mailgun Configuration
MAILGUN_API_KEY=your-mailgun-api-key
MAILGUN_DOMAIN=your-domain.mailgun.org
MAILGUN_FROM_EMAIL=ai-assistant@your-domain.com

# Optional: Cloudflare AI Gateway (for request caching/rate limiting)
# GATEWAY_BASE_URL=https://gateway.ai.cloudflare.com/v1/your-account-id/your-gateway
```

### Step 3: Create KV Namespaces

```bash
# Create production KV namespace
wrangler kv:namespace create "USER_CONFIG"

# Create preview KV namespace (for local development)
wrangler kv:namespace create "USER_CONFIG" --preview
```

Copy the generated IDs and update `wrangler.jsonc`:

```jsonc
{
  "kv_namespaces": [
    {
      "binding": "USER_CONFIG",
      "id": "your-production-id",
      "preview_id": "your-preview-id"
    }
  ]
}
```

### Step 4: Configure Cron Schedule (Optional)

Edit `wrangler.jsonc` to customize when weekly summaries are sent:

```jsonc
{
  "triggers": {
    "crons": ["0 20 * * 0"] // Default: Every Sunday at 8:00 PM UTC
  }
}
```

Cron format: `minute hour day-of-month month day-of-week`

Examples:

- `0 20 * * 0` - Sunday 8:00 PM UTC
- `0 9 * * 1` - Monday 9:00 AM UTC
- `0 18 * * 5` - Friday 6:00 PM UTC

### Step 5: Deploy to Cloudflare

```bash
# Upload secrets to Cloudflare Workers
wrangler secret bulk .dev.vars

# Build and deploy
npm run deploy
```

Your agent will be available at: `https://your-worker-name.your-subdomain.workers.dev`

### Step 6: Local Development

```bash
# Start local development server
npm start

# Open browser to http://localhost:5173
```

## Usage

### Configuring Weekly Summaries

In the chat interface, ask the AI:

```
Please enable weekly summaries and send them to user@example.com
```

The AI will use the `configureWeeklySummary` tool to save your preferences.

### Testing Summary Generation

To generate an immediate preview without waiting for the scheduled run:

```
Generate a summary of my conversations from the last 7 days
```

### Disabling Summaries

```
Please disable my weekly summaries
```

### Manual Cron Trigger (Testing)

```bash
# Trigger the cron job manually for testing
wrangler publish && curl -X POST https://your-worker.workers.dev/__scheduled
```

## Email Summary Format

Weekly summary emails include:

- **Weekly Highlights**: Key topics and themes from conversations
- **Insights**: Patterns in questions, concerns, or interests
- **Recommendations**: 3-5 actionable suggestions based on discussions
- **Next Steps**: Goals or tasks mentioned during the week

Emails are sent as formatted HTML with a professional template.

## Project Structure

```
src/
├── server.ts           # Cloudflare Worker entry point + Chat Durable Object
├── tools.ts            # AI tool definitions (weather, scheduling, summary config)
├── weekly-summary.ts   # Summary generation and email sending logic
├── utils.ts            # Shared utility functions
├── app.tsx             # Main React application component
├── client.tsx          # Client-side entry point
├── components/         # Reusable UI components
├── providers/          # React context providers
└── hooks/              # Custom React hooks

wrangler.jsonc          # Cloudflare Workers configuration
vite.config.ts          # Vite bundler configuration
```

## API Keys and Security

All API keys should be configured as Cloudflare Worker secrets (not in code):

```bash
# Set individual secrets
wrangler secret put OPENAI_API_KEY
wrangler secret put MAILGUN_API_KEY
wrangler secret put MAILGUN_DOMAIN
wrangler secret put MAILGUN_FROM_EMAIL

# Or bulk upload from .dev.vars
wrangler secret bulk .dev.vars
```

Never commit `.dev.vars` or any file containing actual API keys to version control.

## Limitations and Notes

- **User Authentication**: Currently uses a hardcoded user ID (`current-user-id`). Implement proper authentication (OAuth, JWT, etc.) for production multi-user scenarios.
- **Mailgun Free Tier**: Limited to 5,000 emails/month. Upgrade or use alternative email providers (SendGrid, AWS SES) for higher volumes.
- **Cron Triggers**: Cloudflare Workers Paid plan required for cron scheduling.
- **OpenAI Costs**: GPT-4o API calls are metered. Monitor usage via OpenAI dashboard.

## Development Commands

```bash
# Install dependencies
npm install

# Start local development server
npm start

# Run type checking
npx tsc --noEmit

# Run linting and formatting
npm run check

# Format code
npm run format

# Deploy to Cloudflare
npm run deploy

# Generate TypeScript types for Workers environment
npm run types
```

## Troubleshooting

### Error: "You must be logged in to use wrangler"

```bash
wrangler login
```

### Error: "KV namespace not found"

Ensure you've created the KV namespace and updated the IDs in `wrangler.jsonc`.

### Emails not sending

1. Verify Mailgun API key and domain are correct
2. Check Mailgun dashboard for delivery logs
3. Ensure domain is verified in Mailgun
4. Check spam folder for test emails

### Cron trigger not firing

1. Verify cron syntax in `wrangler.jsonc`
2. Check Cloudflare dashboard > Workers > your worker > Triggers
3. Note: Cron triggers require Workers Paid plan

## License

MIT

---

Built with [Cloudflare Workers](https://workers.cloudflare.com/) and [Vercel AI SDK](https://sdk.vercel.ai/)
