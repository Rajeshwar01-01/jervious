import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

type Mode = "spark" | "focus" | "scholar";

const MODE_PROMPTS: Record<Mode, string> = {
  spark:
    "You are Jervious, a warm, imaginative creative partner. Offer fresh angles, vivid examples, and useful next steps. Keep replies lively and clear. When a user asks for ideas, give specific, varied options rather than generic lists.",
  focus:
    "You are Jervious, a calm and practical focus partner. Help the user make progress in small steps. Be concise, prioritize the next action, and make plans realistic. Ask one clarifying question only when it would change the recommendation.",
  scholar:
    "You are Jervious, a curious research companion. Explain ideas carefully, distinguish facts from uncertainty, and organize answers so they are easy to scan. Never invent citations or claim to have browsed the web.",
};

const MAX_BODY_BYTES = 80_000;
const MAX_MESSAGE_COUNT = 30;
const MAX_MESSAGES_BYTES = 60_000;
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

class RequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readLimitedJson(request: Request): Promise<unknown> {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    if (!/^\d+$/.test(contentLength)) {
      throw new RequestError("The request has an invalid content length.", 400);
    }
    if (Number(contentLength) > MAX_BODY_BYTES) {
      throw new RequestError("That conversation is too long to send. Start a fresh chat and try again.", 413);
    }
  }

  if (!request.body) {
    throw new RequestError("Send a message to start a conversation.", 400);
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new RequestError("That conversation is too long to send. Start a fresh chat and try again.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw new RequestError("The request body must be valid JSON.", 400);
  }
}

function parseMessages(value: unknown): UIMessage[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new RequestError("Send a message to start a conversation.", 400);
  }
  if (value.length > MAX_MESSAGE_COUNT) {
    throw new RequestError("This conversation is getting long. Start a fresh chat to continue.", 413);
  }

  const messages: UIMessage[] = value.map((item) => {
    if (!isRecord(item) || typeof item.id !== "string" || item.id.length === 0) {
      throw new RequestError("The conversation contains an invalid message.", 400);
    }
    if (item.role !== "user" && item.role !== "assistant") {
      throw new RequestError("Only user and assistant messages are accepted.", 400);
    }
    if (!Array.isArray(item.parts) || item.parts.length === 0) {
      throw new RequestError("Messages must contain text.", 400);
    }

    const parts = item.parts.map((part) => {
      if (!isRecord(part) || part.type !== "text" || typeof part.text !== "string") {
        throw new RequestError("Only text messages are accepted.", 400);
      }
      return { type: "text" as const, text: part.text };
    });

    return { id: item.id, role: item.role, parts } as UIMessage;
  });

  if (messages[messages.length - 1]?.role !== "user") {
    throw new RequestError("Send a user message to continue the conversation.", 400);
  }

  const messageBytes = new TextEncoder().encode(JSON.stringify(messages)).byteLength;
  if (messageBytes > MAX_MESSAGES_BYTES) {
    throw new RequestError("This conversation is getting long. Start a fresh chat to continue.", 413);
  }

  return messages;
}

function getClientIp(request: Request): string {
  const forwarded =
    request.headers.get("x-vercel-forwarded-for") ??
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

type RateLimiter = InstanceType<typeof Ratelimit>;
let sharedRateLimiter: RateLimiter | undefined;
const developmentBuckets = new Map<string, { count: number; resetAt: number }>();

function getRateLimiter(): RateLimiter | undefined {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return undefined;

  sharedRateLimiter ??= new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(RATE_LIMIT, "60 s"),
    prefix: "jervious:chat",
  });
  return sharedRateLimiter;
}

function localRateLimit(clientIp: string): { success: boolean; reset: number } {
  const now = Date.now();
  const bucket = developmentBuckets.get(clientIp);
  if (!bucket || bucket.resetAt <= now) {
    const resetAt = now + RATE_WINDOW_MS;
    developmentBuckets.set(clientIp, { count: 1, resetAt });
    return { success: true, reset: resetAt };
  }

  if (bucket.count >= RATE_LIMIT) return { success: false, reset: bucket.resetAt };
  bucket.count += 1;
  return { success: true, reset: bucket.resetAt };
}

async function enforceRateLimit(request: Request): Promise<Response | null> {
  const clientIp = getClientIp(request);
  const limiter = getRateLimiter();

  if (!limiter) {
    if (process.env.NODE_ENV === "production") {
      return new Response("Chat rate limiting is not configured. Set the Upstash Redis environment variables.", {
        status: 503,
      });
    }
    const result = localRateLimit(clientIp);
    return result.success
      ? null
      : new Response("You have sent too many messages. Please try again in a minute.", {
          status: 429,
          headers: { "Retry-After": String(Math.max(1, Math.ceil((result.reset - Date.now()) / 1000))) },
        });
  }

  try {
    const result = await limiter.limit(clientIp);
    if (result.success) return null;
    return new Response("You have sent too many messages. Please try again in a minute.", {
      status: 429,
      headers: { "Retry-After": String(Math.max(1, Math.ceil((result.reset - Date.now()) / 1000))) },
    });
  } catch (error) {
    console.error("Jervious rate limit check failed:", error);
    return new Response("Chat is temporarily unavailable. Please try again shortly.", { status: 503 });
  }
}

  export async function POST(request: Request) {
  if (!process.env.AI_GATEWAY_API_KEY) {
    return new Response("Add your AI_GATEWAY_API_KEY to .env.local to connect Jervious to Claude.", {
      status: 503,
    });
  }

  try {
    const rateLimitResponse = await enforceRateLimit(request);
    if (rateLimitResponse) return rateLimitResponse;

    const body = await readLimitedJson(request);
    if (!isRecord(body)) throw new RequestError("The request body must be a JSON object.", 400);

    const messages = parseMessages(body.messages);
    const mode: Mode =
      body.mode === "focus" || body.mode === "scholar" || body.mode === "spark" ? body.mode : "spark";
    const result = streamText({
      model: "anthropic/claude-sonnet-5.5",
      system: MODE_PROMPTS[mode],
      messages: await convertToModelMessages(messages),
      maxOutputTokens: 1400,
      abortSignal: request.signal,
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    if (error instanceof RequestError) {
      return new Response(error.message, { status: error.status });
    }
    console.error("Jervious chat request failed:", error);
    return new Response("Jervious could not complete that request. Please try again.", { status: 500 });
  }
}

