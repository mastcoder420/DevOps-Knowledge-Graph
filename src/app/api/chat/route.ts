import { GoogleGenerativeAI } from '@google/generative-ai';
import { HistoricalPostMortem } from '@/data/incidentData';

export const runtime = 'edge';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  retrievedContexts: HistoricalPostMortem[];
}

export async function POST(req: Request) {
  try {
    const { messages, retrievedContexts } = (await req.json()) as ChatRequest;
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
    
    // Construct rich RAG-augmented system instructions
    const contextText = retrievedContexts && retrievedContexts.length > 0
      ? retrievedContexts.map((pm, idx) => `
[MATCHED HISTORICAL POST-MORTEM #${idx + 1}]
Company: ${pm.company}
Title: ${pm.title}
Date: ${pm.date}
Symptoms: ${pm.symptoms}
Root Cause: ${pm.root_cause}
Resolution: ${pm.resolution}
Remediation Commands:
${pm.remediation_commands.join('\n')}
--------------------------------------------------`).join('\n')
      : "No highly matching historical post-mortems were retrieved for this specific symptom.";

    const systemInstruction = `You are the SRE War Room Diagnostic AI, a specialized cyber-copilot investigating a live production system failure.
You use RAG (Retrieval-Augmented Generation) to analyze new outages by cross-referencing them against our historical post-mortem database.

ACTIVE INCIDENT TO INVESTIGATE:
"${messages[messages.length - 1].content}"

RETRIEVED HISTORICAL CONTEXT:
${contextText}

YOUR INSTRUCTIONS:
1. Thoroughly compare the symptoms of the active incident with the retrieved historical post-mortems.
2. Determine if the active incident correlates with any historical failure (e.g. if the user reports global edge gateway CPU bottlenecks, correlate it with Cloudflare's 2019 WAF regex backtracking outage).
3. Draft a precise SRE Root Cause Analysis including:
   - **INCIDENT CLASSIFICATION** (e.g., Extreme CPU Spike on Edge Proxy)
   - **RETRIEVAL CORRELATION ANALYSIS** (Explain which past post-mortem matched, why, and show the match relevance logic)
   - **ROOT CAUSE HYPOTHESIS & CASCADE IMPACT** (Step-by-step breakdown of how the failure propagates)
   - **ACTIONABLE MITIGATION PROTOCOL** (Step-by-step shell commands, queries, or emergency changes to execute immediately based on historical resolutions)
4. Keep the output highly technical, structured, and formulated in an elite, focused SRE command-center tone.`;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: systemInstruction
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
