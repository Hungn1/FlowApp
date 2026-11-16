import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";

// Every AI call goes through here. Your data is only ever sent to the Anthropic API.
export const AI_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

export class AiError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
  }
}

export function aiConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;
function getClient() {
  if (!aiConfigured()) {
    throw new AiError(
      "AI is not set up yet. Add ANTHROPIC_API_KEY to the .env.local file in the project folder, then restart npm run dev.",
      503
    );
  }
  client ??= new Anthropic({ timeout: 120_000, maxRetries: 2 });
  return client;
}

const GROUNDING =
  "You are part of ApplyFlow, a job-application assistant for an entry-level tech job seeker. " +
  "Never invent experience, employers, dates, skills, certifications, metrics, or numbers. " +
  "Only use facts present in the input you are given.";

/** Ask Claude for JSON that matches a Zod schema. Throws AiError with a readable message. */
export async function generateStructured<S extends z.ZodType>(opts: {
  schema: S;
  system: string;
  prompt: string;
  maxTokens?: number;
  effort?: "low" | "medium" | "high";
}): Promise<z.infer<S>> {
  const anthropic = getClient();
  try {
    const response = await anthropic.beta.messages.parse({
      model: AI_MODEL,
      max_tokens: opts.maxTokens ?? 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: `${GROUNDING}\n\n${opts.system}`,
      messages: [{ role: "user", content: opts.prompt }],
      output_config: { effort: opts.effort ?? "low", format: betaZodOutputFormat(opts.schema) },
    });
    if (response.stop_reason === "refusal") {
      throw new AiError("The AI declined this request. Try editing the text and retry.", 422);
    }
    if (response.stop_reason === "max_tokens") {
      throw new AiError("The AI response was cut off because the input is very long. Try shortening it and retry.", 422);
    }
    if (!response.parsed_output) {
      throw new AiError("The AI returned something unexpected. Please retry.", 502);
    }
    return response.parsed_output as z.infer<S>;
  } catch (err) {
    if (err instanceof AiError) throw err;
    if (err instanceof Anthropic.AuthenticationError) {
      throw new AiError("Your ANTHROPIC_API_KEY was rejected. Check the key in .env.local and restart.", 401);
    }
    if (err instanceof Anthropic.RateLimitError) {
      throw new AiError("The AI is rate-limited right now. Wait a minute and retry.", 429);
    }
    if (err instanceof Anthropic.BadRequestError) {
      throw new AiError(`The AI request was rejected: ${err.message}`, 400);
    }
    if (err instanceof Anthropic.APIConnectionError) {
      throw new AiError("Couldn't reach the Anthropic API. Check your internet connection and retry.", 503);
    }
    if (err instanceof Anthropic.APIError && (err.status === 529 || err.status === 503)) {
      throw new AiError("The AI service is busy right now. Wait a moment and retry.", 503);
    }
    if (err instanceof Anthropic.APIError) {
      throw new AiError(`The AI service had a problem (${err.status ?? "unknown"}). Please retry.`, 502);
    }
    throw err;
  }
}
