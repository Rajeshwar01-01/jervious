import { convertToModelMessages, streamText, type UIMessage } from "ai";

const MODE_PROMPTS: Record<string, string> = {
  spark: "You are Jervious, a warm, imaginative creative partner. Offer fresh angles, vivid examples, and useful next steps. Keep replies lively and clear. When a user asks for ideas, give specific, varied options rather than generic lists.",
  focus: "You are Jervious, a calm and practical focus partner. Help the user make progress in small steps. Be concise, prioritize the next action, and make plans realistic. Ask one clarifying question only when it would change the recommendation.",
  scholar: "You are Jervious, a curious research companion. Explain ideas carefully, distinguish facts from uncertainty, and organize answers so they are easy to scan. Never invent citations or claim to have browsed the web.",
};

export async function POST(request: Request) {
  if (!process.env.AI_GATEWAY_API_KEY) {
    return new Response("Add your AI_GATEWAY_API_KEY to .env.local to connect Jervious to Claude.", {
      status: 503,
    });
  }

  try {
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 80_000) {
      return new Response("That conversation is too long to send. Start a fresh chat and try again.", { status: 413 });
    }

    const body = (await request.json()) as { messages?: UIMessage[]; mode?: string };
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return new Response("Send a message to start a conversation.", { status: 400 });
    }
    if (body.messages.length > 30 || JSON.stringify(body.messages).length > 60_000) {
      return new Response("This conversation is getting long. Start a fresh chat to continue.", { status: 413 });
    }

    const mode = body.mode && MODE_PROMPTS[body.mode] ? body.mode : "spark";
    const result = streamText({
      model: "anthropic/claude-sonnet-5.5",
      system: MODE_PROMPTS[mode],
      messages: await convertToModelMessages(body.messages),
      maxOutputTokens: 1400,
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("Jervious chat request failed:", error);
    return new Response("Jervious could not complete that request. Please try again.", { status: 500 });
  }
}

