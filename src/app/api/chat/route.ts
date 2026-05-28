import { GoogleGenerativeAI } from '@google/generative-ai';
import { mockIncidents } from '@/data/incidentData';

export const runtime = 'edge';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(req: Request) {
  try {
    const { messages } = (await req.json()) as { messages: ChatMessage[] };
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ 
        error: "GEMINI_API_KEY is not configured on the server. Please add it to your environment variables or .env.local file." 
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: `You are the SRE War Room Diagnostic AI, the "collective engineering memory" of this infrastructure.
Here is the historical log database of complex microservice outages:
${JSON.stringify(mockIncidents, null, 2)}

Microservice Topology:
- api-gateway DEPENDS ON [auth-service, payment-service]
- auth-service DEPENDS ON [redis-cache, user-db]
- payment-service DEPENDS ON [redis-cache, payment-db]

When a user submits an alert, error stack trace, or custom query:
1. Cross-reference their query with the microservice topology and the historical outages.
2. Identify the cascading path. (e.g., If the user query is about "auth-service locking up," point out that user-db might be experiencing deadlocks or connection pool exhaustion, leading to cascading HTTP 504 errors on the api-gateway).
3. If the query matches a historical incident, explain the connection.
4. Stream a professional, clear, highly structured SRE Root Cause Analysis:
   - **INCIDENT CLASSIFICATION** (e.g., Critical Database Bottleneck)
   - **CASCADING IMPACT ANALYSIS** (Which services are degraded/blocked based on dependencies)
   - **ROOT CAUSE DIAGNOSIS** (Detailed explanation of why it failed)
   - **REMEDIATION COMMANDS** (Actionable step-by-step CLI commands, database adjustments, or config changes)
5. Maintain a professional, hyper-focused, elite SRE tone.`
    });

    // Format chat history for Gemini:
    // Gemini chat API uses { role: 'user' | 'model', parts: [{ text: string }] }
    const chatHistory = messages.slice(0, -1).map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }]
    }));

    const latestMessage = messages[messages.length - 1].content;

    const chat = model.startChat({
      history: chatHistory,
    });

    const result = await chat.sendMessageStream(latestMessage);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.stream) {
            const text = chunk.text();
            controller.enqueue(encoder.encode(text));
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked'
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    console.error("Chat API error:", error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

