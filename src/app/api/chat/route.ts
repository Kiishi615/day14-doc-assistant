import OpenAI from "openai";
import { embedText } from "@/lib/embeddings";
import { queryChunks } from "@/lib/pinecone";

export const maxDuration = 60;

const MAX_RECENT = 6; // 3 user-AI pairs kept verbatim in prompt

// Lazy-init to avoid crash during Vercel build (no env vars at build time)
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
    if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    return _openai;
}

// ── Reformulate follow-up questions into standalone queries ──
async function reformulateQuery(
    question: string,
    summary: string,
    recentMessages: { role: string; content: string }[]
): Promise<{ query: string; tokens: { prompt: number; completion: number } }> {
    if (recentMessages.length === 0 && !summary) {
        return { query: question, tokens: { prompt: 0, completion: 0 } };
    }

    const recentStr = recentMessages
        .map((m) => `${m.role === "user" ? "Human" : "AI"}: ${m.content}`)
        .join("\n");

    const res = await getOpenAI().chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            {
                role: "system",
                content: `Rewrite the user's latest message as a standalone question that can be understood WITHOUT any conversation history. Resolve all pronouns (he/she/it/they/that/this). Do NOT answer the question, only rewrite it. If it's already standalone, return it as-is. Return ONLY the rewritten question, nothing else.`,
            },
            {
                role: "user",
                content: `Conversation summary: ${summary || "No previous conversation."}\n\nRecent messages:\n${recentStr || "No recent messages."}\n\nUser's latest message: ${question}\n\nStandalone question:`,
            },
        ],
        max_tokens: 200,
        temperature: 0,
    });

    const reformulated = res.choices[0]?.message?.content?.trim() || question;
    const tokens = {
        prompt: res.usage?.prompt_tokens ?? 0,
        completion: res.usage?.completion_tokens ?? 0,
    };
    console.log(`🔄 Reformulated: "${reformulated.slice(0, 100)}" (${tokens.prompt}+${tokens.completion} tokens)`);
    return { query: reformulated, tokens };
}

// ── Summarize older messages into a compact running summary ──
async function summarizeOverflow(
    existingSummary: string,
    newMessages: { role: string; content: string }[]
): Promise<{ summary: string; tokens: { prompt: number; completion: number } }> {
    const newStr = newMessages
        .map((m) => `${m.role === "user" ? "Human" : "AI"}: ${m.content}`)
        .join("\n");

    const res = await getOpenAI().chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            {
                role: "system",
                content: `Summarize this conversation concisely. Capture key topics, facts discussed, and any conclusions. Keep it under 200 words.`,
            },
            {
                role: "user",
                content: `Previous summary: ${existingSummary || "No previous summary."}\n\nNew messages:\n${newStr}\n\nUpdated summary:`,
            },
        ],
        max_tokens: 300,
        temperature: 0,
    });

    const summary = res.choices[0]?.message?.content?.trim() || existingSummary;
    const tokens = {
        prompt: res.usage?.prompt_tokens ?? 0,
        completion: res.usage?.completion_tokens ?? 0,
    };
    console.log(`📝 Summary updated (${summary.length} chars, ${tokens.prompt}+${tokens.completion} tokens)`);
    return { summary, tokens };
}

export async function POST(req: Request) {
    let body;
    try {
        body = await req.json();
    } catch {
        return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { messages, sessionId, selectedDocuments, summary: existingSummary = "", summaryMsgCount = 0 } = body;

    if (!sessionId) {
        return Response.json({ error: "Missing sessionId" }, { status: 400 });
    }
    if (!process.env.OPENAI_API_KEY) {
        console.error("❌ OPENAI_API_KEY is not set");
        return Response.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
    }

    const lastMessage = messages?.[messages.length - 1];
    if (!lastMessage || lastMessage.role !== "user") {
        return Response.json({ error: "No user message found" }, { status: 400 });
    }

    try {
        // ── Memory management: summary + recent window ──
        const previousMessages = messages.slice(0, -1) as { role: string; content: string }[];

        let currentSummary = existingSummary;
        let currentSummaryMsgCount = summaryMsgCount;
        let summaryTokens = { prompt: 0, completion: 0 };

        // Split into: already-summarized | needs-summarizing | recent-window
        let recentMessages: { role: string; content: string }[];

        if (previousMessages.length > MAX_RECENT) {
            recentMessages = previousMessages.slice(-MAX_RECENT);

            // Messages that should be in the summary but aren't yet
            const newOverflow = previousMessages.slice(currentSummaryMsgCount, previousMessages.length - MAX_RECENT);

            if (newOverflow.length > 0) {
                console.log(`📝 Summarizing ${newOverflow.length} overflow messages (${currentSummaryMsgCount} already summarized)`);
                const result = await summarizeOverflow(currentSummary, newOverflow);
                currentSummary = result.summary;
                summaryTokens = result.tokens;
                currentSummaryMsgCount = previousMessages.length - MAX_RECENT;
            }
        } else {
            recentMessages = previousMessages;
        }

        // 1. Reformulate using summary + recent messages
        const { query: searchQuery, tokens: reformTokens } = await reformulateQuery(
            lastMessage.content, currentSummary, recentMessages
        );

        // 2. Embed the reformulated query
        console.log(`🔍 Embedding: "${searchQuery.slice(0, 80)}..."`);
        const queryVector = await embedText(searchQuery);

        // 3. Query Pinecone
        const filter =
            selectedDocuments && selectedDocuments.length > 0
                ? { source: { $in: selectedDocuments } }
                : undefined;

        console.log(`📌 Querying Pinecone namespace=${sessionId}`);
        const results = await queryChunks(sessionId, queryVector, 10, filter);
        console.log(`📄 Retrieved ${results.length} chunks`);

        // 4. Build context from parent chunks (deduplicated)
        const seenParents = new Set<string>();
        const parentTexts: string[] = [];
        for (const r of results) {
            const pid = String(r.metadata.parentId ?? "");
            if (pid && seenParents.has(pid)) continue;
            if (pid) seenParents.add(pid);
            const pText = String(r.metadata.parentText ?? r.metadata.text ?? "");
            if (pText) parentTexts.push(pText);
        }
        const context = parentTexts.length > 0
            ? parentTexts.join("\n\n---\n\n")
            : "No relevant context found in the uploaded documents.";

        // 5. Build recent conversation string for the answer prompt
        const recentStr = recentMessages
            .map((m) => `${m.role === "user" ? "Human" : "AI"}: ${m.content}`)
            .join("\n");

        // 6. Build messages for GPT (includes summary for global context)
        const systemMessage = {
            role: "system" as const,
            content: `You are a knowledgeable document assistant called DocAssist. Answer questions based ONLY on the provided context from the user's uploaded documents. If the context doesn't contain enough information, say "I couldn't find information about that in your documents." Be conversational but accurate. Do not make things up. Format your responses with markdown when helpful.`,
        };

        const userMessage = {
            role: "user" as const,
            content: `Context from uploaded documents:\n---\n${context}\n---\n\nConversation summary: ${currentSummary || "No previous conversation."}\n\nRecent messages:\n${recentStr || "None."}\n\nQuestion: ${lastMessage.content}`,
        };

        // 7. Stream with GPT-4o-mini
        console.log("🤖 Calling GPT-4o Mini...");
        const completion = await getOpenAI().chat.completions.create({
            model: "gpt-4o-mini",
            messages: [systemMessage, userMessage],
            stream: true,
            stream_options: { include_usage: true },
        });

        // 8. Stream response + append sentinels
        const encoder = new TextEncoder();
        let answerPromptTokens = 0;
        let answerCompletionTokens = 0;

        const stream = new ReadableStream({
            async start(controller) {
                try {
                    for await (const chunk of completion) {
                        if (chunk.usage) {
                            answerPromptTokens = chunk.usage.prompt_tokens;
                            answerCompletionTokens = chunk.usage.completion_tokens;
                        }
                        const text = chunk.choices[0]?.delta?.content;
                        if (text) {
                            controller.enqueue(encoder.encode(text));
                        }
                    }

                    // Usage sentinel
                    const totalPrompt = answerPromptTokens + reformTokens.prompt + summaryTokens.prompt;
                    const totalCompletion = answerCompletionTokens + reformTokens.completion + summaryTokens.completion;
                    const usageSentinel = `\n\n<!--USAGE:${JSON.stringify({
                        prompt: totalPrompt,
                        completion: totalCompletion,
                        total: totalPrompt + totalCompletion,
                    })}-->`;
                    controller.enqueue(encoder.encode(usageSentinel));

                    // Summary sentinel (so frontend can persist it)
                    if (currentSummary) {
                        const summarySentinel = `<!--SUMMARY:${JSON.stringify({
                            text: currentSummary,
                            msgCount: currentSummaryMsgCount,
                        })}-->`;
                        controller.enqueue(encoder.encode(summarySentinel));
                    }

                    controller.close();
                    console.log(`✅ Stream complete (${totalPrompt}+${totalCompletion} tokens, summary: ${currentSummaryMsgCount} msgs)`);
                } catch (streamErr) {
                    console.error("❌ Stream error:", streamErr);
                    controller.error(streamErr);
                }
            },
        });

        return new Response(stream, {
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "Cache-Control": "no-cache",
            },
        });
    } catch (error) {
        console.error("❌ Chat API error:", error);
        const message = error instanceof Error ? error.message : "Chat failed";
        return Response.json({ error: message }, { status: 500 });
    }
}
