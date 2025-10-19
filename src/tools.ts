/**
 * Tool definitions for the AI chat agent
 * Tools can either require human confirmation or execute automatically
 */
import { tool, type ToolSet } from "ai";
import { z } from "zod/v3";

import type { Chat, Env } from "./server";
import { getCurrentAgent } from "agents";
import { scheduleSchema } from "agents/schedule";

/**
 * Weather information tool that requires human confirmation
 * When invoked, this will present a confirmation dialog to the user
 */
const getWeatherInformation = tool({
  description: "show the weather in a given city to the user",
  inputSchema: z.object({ city: z.string() })
  // Omitting execute function makes this tool require human confirmation
});

/**
 * Local time tool that executes automatically
 * Since it includes an execute function, it will run without user confirmation
 * This is suitable for low-risk operations that don't need oversight
 */
const getLocalTime = tool({
  description: "get the local time for a specified location",
  inputSchema: z.object({ location: z.string() }),
  execute: async ({ location }) => {
    console.log(`Getting local time for ${location}`);
    return "10am";
  }
});

/**
 * Tool to schedule a task to be executed at a later time
 */
const scheduleTask = tool({
  description: "A tool to schedule a task to be executed at a later time",
  inputSchema: scheduleSchema,
  execute: async ({ when, description }) => {
    // we can now read the agent context from the ALS store
    const { agent } = getCurrentAgent<Chat>();

    function throwError(msg: string): string {
      throw new Error(msg);
    }
    if (when.type === "no-schedule") {
      return "Not a valid schedule input";
    }
    const input =
      when.type === "scheduled"
        ? when.date // scheduled
        : when.type === "delayed"
          ? when.delayInSeconds // delayed
          : when.type === "cron"
            ? when.cron // cron
            : throwError("not a valid schedule input");
    try {
      agent!.schedule(input!, "executeTask", description);
    } catch (error) {
      console.error("error scheduling task", error);
      return `Error scheduling task: ${error}`;
    }
    return `Task scheduled for type "${when.type}" : ${input}`;
  }
});

/**
 * Tool to list all scheduled tasks
 * This executes automatically without requiring human confirmation
 */
const getScheduledTasks = tool({
  description: "List all tasks that have been scheduled",
  inputSchema: z.object({}),
  execute: async () => {
    const { agent } = getCurrentAgent<Chat>();

    try {
      const tasks = agent!.getSchedules();
      if (!tasks || tasks.length === 0) {
        return "No scheduled tasks found.";
      }
      return tasks;
    } catch (error) {
      console.error("Error listing scheduled tasks", error);
      return `Error listing scheduled tasks: ${error}`;
    }
  }
});

/**
 * Tool to cancel a scheduled task by its ID
 * This executes automatically without requiring human confirmation
 */
const cancelScheduledTask = tool({
  description: "Cancel a scheduled task using its ID",
  inputSchema: z.object({
    taskId: z.string().describe("The ID of the task to cancel")
  }),
  execute: async ({ taskId }) => {
    const { agent } = getCurrentAgent<Chat>();
    try {
      await agent!.cancelSchedule(taskId);
      return `Task ${taskId} has been successfully canceled.`;
    } catch (error) {
      console.error("Error canceling scheduled task", error);
      return `Error canceling task ${taskId}: ${error}`;
    }
  }
});

/**
 * Tool to configure weekly AI conversation summary
 */
const configureWeeklySummary = tool({
  description:
    "Configure weekly AI conversation summary to be sent to user's email",
  inputSchema: z.object({
    email: z.string().email().describe("User's email address"),
    enable: z.boolean().describe("Enable or disable weekly summaries")
  }),
  execute: async ({ email, enable }) => {
    try {
      const { agent } = getCurrentAgent<Chat>();
      // Access env through type assertion (env is protected but accessible at runtime)
      const env = (agent as unknown as { env: Env }).env;
      const userId = "current-user-id"; // TODO: Get actual user ID from context

      // Save configuration to KV
      await env.USER_CONFIG.put(
        `user:${userId}`,
        JSON.stringify({
          userId,
          email,
          enableWeeklySummary: enable,
          updatedAt: new Date().toISOString()
        })
      );

      return {
        success: true,
        message: enable
          ? `✅ Weekly summaries will be sent to ${email} every Sunday evening`
          : `❌ Weekly summaries have been disabled`
      };
    } catch (error) {
      console.error("Error configuring weekly summary:", error);
      return {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      };
    }
  }
});

/**
 * Tool to generate and preview a weekly summary immediately (for testing)
 */
const generateSummaryNow = tool({
  description:
    "Generate and preview a weekly summary immediately (for testing)",
  inputSchema: z.object({
    days: z
      .number()
      .optional()
      .describe("Number of days to include (default: 7)")
  }),
  execute: async ({ days = 7 }) => {
    try {
      const { agent } = getCurrentAgent<Chat>();
      // Access env through type assertion (env is protected but accessible at runtime)
      const env = (agent as unknown as { env: Env }).env;
      const { generateWeeklySummary, getUserConversations } = await import(
        "./weekly-summary"
      );

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const userId = "current-user-id"; // TODO: Get actual user ID from context
      const chatId = env.Chat.idFromName(userId);
      const chatStub = env.Chat.get(chatId);

      const conversations = await getUserConversations(
        chatStub,
        userId,
        startDate,
        endDate
      );

      if (!conversations || conversations.length === 0) {
        return "No conversations found in the specified period.";
      }

      const summary = await generateWeeklySummary(conversations, env);
      return summary;
    } catch (error) {
      console.error("Error generating summary:", error);
      return `Error generating summary: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  }
});

/**
 * Export all available tools
 * These will be provided to the AI model to describe available capabilities
 */
export const tools = {
  getWeatherInformation,
  getLocalTime,
  scheduleTask,
  getScheduledTasks,
  cancelScheduledTask,
  configureWeeklySummary,
  generateSummaryNow
} satisfies ToolSet;

/**
 * Implementation of confirmation-required tools
 * This object contains the actual logic for tools that need human approval
 * Each function here corresponds to a tool above that doesn't have an execute function
 */
export const executions = {
  getWeatherInformation: async ({ city }: { city: string }) => {
    console.log(`Getting weather information for ${city}`);
    return `The weather in ${city} is sunny`;
  }
};
