import { routeAgentRequest, type Schedule } from "agents";
import { getSchedulePrompt } from "agents/schedule";
import { AIChatAgent } from "agents/ai-chat-agent";
import {
  generateId,
  streamText,
  type StreamTextOnFinishCallback,
  stepCountIs,
  createUIMessageStream,
  convertToModelMessages,
  createUIMessageStreamResponse,
  type ToolSet
} from "ai";
import { openai } from "@ai-sdk/openai";
import { processToolCalls, cleanupMessages } from "./utils";
import { tools, executions } from "./tools";
import { processWeeklySummaries } from "./weekly-summary";

const model = openai("gpt-4o-2024-11-20");

/**
 * Environment bindings interface
 */
interface Env {
  OPENAI_API_KEY: string;
  USER_CONFIG: KVNamespace;
  Chat: DurableObjectNamespace;
  MAILGUN_API_KEY: string;
  MAILGUN_DOMAIN: string;
  MAILGUN_FROM_EMAIL: string;
  AI: any;
}

/**
 * Message interface for SQL results
 */
interface StoredMessage {
  id: string;
  userId: string;
  role: string;
  content: string;
  createdAt: string;
  [key: string]: any;
}

/**
 * Chat Agent implementation that handles real-time AI chat interactions
 */
export class Chat extends AIChatAgent<Env> {
  /**
   * Handles incoming chat messages and manages the response stream
   */
  async onChatMessage(
    onFinish: StreamTextOnFinishCallback<ToolSet>,
    _options?: { abortSignal?: AbortSignal }
  ) {
    // Collect all tools, including MCP tools
    const allTools = {
      ...tools,
      ...this.mcp.getAITools()
    };

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        // Clean up incomplete tool calls to prevent API errors
        const cleanedMessages = cleanupMessages(this.messages);

        // Process any pending tool calls from previous messages
        // This handles human-in-the-loop confirmations for tools
        const processedMessages = await processToolCalls({
          messages: cleanedMessages,
          dataStream: writer,
          tools: allTools,
          executions
        });

        const result = streamText({
          system: `You are a helpful AI assistant that can perform various tasks including:
- Answering questions and providing information
- Scheduling tasks for later execution
- Configuring weekly conversation summaries
- Checking weather information
- Managing your calendar and tasks

${getSchedulePrompt({ date: new Date() })}

When the user asks to schedule a task, use the scheduleTask tool.
When the user wants to set up weekly summaries, use the configureWeeklySummary tool.
Always be helpful, accurate, and proactive in suggesting relevant tools.`,

          messages: convertToModelMessages(processedMessages),
          model,
          tools: allTools,
          // Type boundary: streamText expects specific tool types, but base class uses ToolSet
          // This is safe because our tools satisfy ToolSet interface (verified by 'satisfies' in tools.ts)
          onFinish: onFinish as unknown as StreamTextOnFinishCallback
            typeof allTools
          >,
          stopWhen: stepCountIs(10)
        });

        writer.merge(result.toUIMessageStream());
      }
    });

    return createUIMessageStreamResponse({ stream });
  }

  /**
   * Execute a scheduled task
   */
  async executeTask(description: string, _task: Schedule<string>) {
    await this.saveMessages([
      ...this.messages,
      {
        id: generateId(),
        role: "user",
        parts: [
          {
            type: "text",
            text: `Running scheduled task: ${description}`
          }
        ],
        metadata: {
          createdAt: new Date()
        }
      }
    ]);
  }

  /**
   * Fetch conversation history or handle other custom routes
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/get-messages") {
      try {
        const userId = url.searchParams.get("userId");
        const start = url.searchParams.get("start");
        const end = url.searchParams.get("end");

        if (!userId || !start || !end) {
          return Response.json(
            { error: "Missing required parameters: userId, start, end" },
            { status: 400 }
          );
        }

        // Query messages from the database
        // Note: Field names may need adjustment based on your actual schema
        // Common patterns: user_id or userId, created_at or createdAt
        const result = await this.sql.exec(
          `SELECT * FROM messages 
           WHERE userId = ? 
           AND createdAt >= ? 
           AND createdAt <= ?
           ORDER BY createdAt ASC`,
          [userId, start, end]
        );

        const messages = (result?.rows || []) as StoredMessage[];

        return Response.json({
          success: true,
          count: messages.length,
          messages
        });

      } catch (error) {
        console.error("Error fetching messages:", error);
        return Response.json(
          {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error"
          },
          { status: 500 }
        );
      }
    }

    // Delegate to parent class for other routes
    return super.fetch(request);
  }
}

/**
 * Worker entry point that routes incoming requests to the appropriate handler
 */
export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext) {
    const url = new URL(request.url);

    // Health check endpoint for OpenAI API key
    if (url.pathname === "/check-open-ai-key") {
      const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
      return Response.json({
        success: hasOpenAIKey,
        message: hasOpenAIKey 
          ? "OpenAI API key is configured" 
          : "OpenAI API key is missing"
      });
    }

    // Warn if OpenAI API key is not set
    if (!process.env.OPENAI_API_KEY) {
      console.error(
        "⚠️ OPENAI_API_KEY is not set. " +
        "Set it locally in .dev.vars, and use 'wrangler secret bulk .dev.vars' to upload to production"
      );
    }

    // Route the request to our agent or return 404 if not found
    return (
      (await routeAgentRequest(request, env)) ||
      new Response("Not found", { status: 404 })
    );
  },

  /**
   * Scheduled event handler for cron triggers
   * Runs weekly summary generation
   */
  async scheduled(
    _event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    console.log("⏰ Cron trigger fired:", new Date().toISOString());

    try {
      // Execute weekly summary processing
      ctx.waitUntil(
        processWeeklySummaries(env).catch((error) => {
          console.error("Error in weekly summary processing:", error);
        })
      );
      
      console.log("Weekly summary processing initiated");
    } catch (error) {
      console.error("Error scheduling weekly summary:", error);
    }
  }
} satisfies ExportedHandler<Env>;