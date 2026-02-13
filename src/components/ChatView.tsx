"use client";

import Sidebar from "@/components/Sidebar";
import MessageBubble from "@/components/MessageBubble";
import ChatInput from "@/components/ChatInput";
import ExportButton from "@/components/ExportButton";
import { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { MessageSquare, Trash2, Zap } from "lucide-react";
import type { DocumentInfo, Message, TokenUsage, Conversation } from "@/app/page";

interface Props {
    sessionId: string;
    documents: DocumentInfo[];
    messages: Message[];
    tokenUsage: TokenUsage;
    summary: string;
    summaryMsgCount: number;
    conversations: Conversation[];
    activeConversationId: string;
    onToggleDocument: (id: string) => void;
    onUploadMore: (docs: DocumentInfo[]) => void;
    onEndSession: () => void;
    onSetMessages: (messages: Message[]) => void;
    onAddTokens: (usage: TokenUsage) => void;
    onClearHistory: () => void;
    onUpdateSummary: (summary: string, msgCount: number) => void;
    onNewConversation: () => void;
    onSwitchConversation: (id: string) => void;
    onDeleteConversation: (id: string) => void;
}

// Parse sentinels from streamed text
function extractSentinels(text: string): {
    cleanText: string;
    usage: TokenUsage | null;
    summary: { text: string; msgCount: number } | null;
} {
    let cleanText = text;
    let usage: TokenUsage | null = null;
    let summary: { text: string; msgCount: number } | null = null;

    // Extract summary sentinel
    const summaryMatch = cleanText.match(/<!--SUMMARY:(.*?)-->\s*$/);
    if (summaryMatch) {
        try {
            summary = JSON.parse(summaryMatch[1]);
        } catch { /* ignore */ }
        cleanText = cleanText.slice(0, summaryMatch.index!);
    }

    // Extract usage sentinel
    const usageMatch = cleanText.match(/\n\n<!--USAGE:(.*?)-->\s*$/);
    if (usageMatch) {
        try {
            usage = JSON.parse(usageMatch[1]) as TokenUsage;
        } catch { /* ignore */ }
        cleanText = cleanText.slice(0, usageMatch.index!);
    }

    return { cleanText, usage, summary };
}

function estimateCost(usage: TokenUsage): string {
    const inputCost = (usage.prompt / 1_000_000) * 0.15;
    const outputCost = (usage.completion / 1_000_000) * 0.60;
    return (inputCost + outputCost).toFixed(4);
}

export default function ChatView({
    sessionId, documents, messages, tokenUsage, summary, summaryMsgCount,
    conversations, activeConversationId,
    onToggleDocument, onUploadMore, onEndSession, onSetMessages, onAddTokens,
    onClearHistory, onUpdateSummary, onNewConversation, onSwitchConversation, onDeleteConversation,
}: Props) {
    const selectedDocs = documents.filter((d) => d.selected).map((d) => d.name);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSubmit = useCallback(async (e?: React.FormEvent) => {
        e?.preventDefault();
        const text = input.trim();
        if (!text || isLoading) return;

        setError("");
        setInput("");
        setIsLoading(true);

        const userMsg: Message = { id: Date.now().toString(), role: "user", content: text };
        const assistantId = (Date.now() + 1).toString();
        const assistantMsg: Message = { id: assistantId, role: "assistant", content: "" };

        const nextMessages = [...messages, userMsg, assistantMsg];
        onSetMessages(nextMessages);

        const apiMessages = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));

        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: apiMessages,
                    sessionId,
                    selectedDocuments: selectedDocs,
                    summary,
                    summaryMsgCount,
                }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
                throw new Error(data.error || `Request failed: ${res.status}`);
            }
            if (!res.body) throw new Error("No response body");

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let fullText = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                fullText += decoder.decode(value, { stream: true });

                // Show text without sentinels (they arrive at the very end)
                const { cleanText } = extractSentinels(fullText);
                const displayText = cleanText;
                onSetMessages([...messages, userMsg, { ...assistantMsg, content: displayText }]);
            }

            // Extract final sentinels
            const { cleanText, usage, summary: newSummary } = extractSentinels(fullText);

            if (!cleanText.trim()) {
                setError("Empty response — try rephrasing your question.");
                onSetMessages(messages); // revert
            } else {
                onSetMessages([...messages, userMsg, { ...assistantMsg, content: cleanText }]);
                if (usage) {
                    onAddTokens(usage);
                }
                if (newSummary) {
                    onUpdateSummary(newSummary.text, newSummary.msgCount);
                }
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Unknown error";
            setError(msg);
            onSetMessages(messages); // revert
        } finally {
            setIsLoading(false);
        }
    }, [input, isLoading, messages, sessionId, selectedDocs, summary, summaryMsgCount, onSetMessages, onAddTokens, onUpdateSummary]);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value);
    }, []);

    const activeConvo = conversations.find((c) => c.id === activeConversationId);

    return (
        <div className="h-full flex">
            <Sidebar
                documents={documents}
                onToggleDocument={onToggleDocument}
                onUploadMore={onUploadMore}
                onEndSession={onEndSession}
                sessionId={sessionId}
                conversations={conversations}
                activeConversationId={activeConversationId}
                onNewConversation={onNewConversation}
                onSwitchConversation={onSwitchConversation}
                onDeleteConversation={onDeleteConversation}
            />

            <div className="flex-1 flex flex-col min-w-0 relative">
                <div className="absolute inset-0 bg-grid opacity-40" />
                <div className="absolute inset-0 bg-glow" />

                {/* ── Chat header with actions ── */}
                <div className="relative flex items-center justify-between px-6 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                    <div className="flex items-center gap-3">
                        <h3 className="text-sm font-medium truncate max-w-[300px]" style={{ color: "var(--text)" }}>
                            {activeConvo?.title || "Chat"}
                        </h3>
                        {messages.length > 0 && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md" style={{ background: "var(--accent-dim)", color: "var(--accent)" }}>
                                {Math.ceil(messages.length / 2)} turns
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        {messages.length > 0 && (
                            <button
                                onClick={onClearHistory}
                                className="p-2 rounded-lg transition-all"
                                style={{ color: "var(--text-3)" }}
                                title="Clear chat history"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}
                        <ExportButton
                            messages={messages}
                            tokenUsage={tokenUsage}
                            conversationTitle={activeConvo?.title || "Chat"}
                        />
                    </div>
                </div>

                {/* ── Messages ── */}
                <div ref={scrollRef} className="relative flex-1 overflow-y-auto">
                    <div className="max-w-3xl mx-auto px-6 py-8 space-y-5">
                        {messages.length === 0 && (
                            <motion.div
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6 }}
                                className="flex flex-col items-center justify-center py-32 text-center"
                            >
                                <div className="w-16 h-16 rounded-2xl glass flex items-center justify-center mb-6 glow-sm">
                                    <MessageSquare className="w-7 h-7" style={{ color: "var(--accent)", opacity: 0.5 }} />
                                </div>
                                <p className="text-lg font-light" style={{ color: "var(--text-2)" }}>
                                    Ask a question about your documents
                                </p>
                                <p className="text-sm mt-3 font-mono" style={{ color: "var(--text-3)" }}>
                                    {selectedDocs.length} of {documents.length} document{documents.length !== 1 ? "s" : ""} selected
                                </p>
                            </motion.div>
                        )}

                        {messages.map((msg, i) => (
                            <MessageBubble
                                key={msg.id}
                                role={msg.role}
                                content={msg.content}
                                isStreaming={isLoading && i === messages.length - 1 && msg.role === "assistant"}
                                index={i}
                            />
                        ))}

                        {error && (
                            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                className="glass rounded-xl p-4 max-w-sm mx-auto text-center"
                                style={{ borderColor: "rgba(239,68,68,0.15)" }}
                            >
                                <p className="text-sm" style={{ color: "rgba(239,68,68,0.8)" }}>{error}</p>
                            </motion.div>
                        )}
                    </div>
                </div>

                {/* ── Token stats bar ── */}
                {tokenUsage.total > 0 && (
                    <div className="relative flex items-center justify-center gap-6 py-2" style={{ borderTop: "1px solid var(--border)" }}>
                        <div className="flex items-center gap-1.5">
                            <Zap className="w-3 h-3" style={{ color: "var(--accent)" }} />
                            <span className="text-[10px] font-mono" style={{ color: "var(--text-3)" }}>
                                {tokenUsage.total.toLocaleString()} tokens
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono" style={{ color: "var(--text-4)" }}>
                                ↑{tokenUsage.prompt.toLocaleString()}
                            </span>
                            <span className="text-[10px] font-mono" style={{ color: "var(--text-4)" }}>
                                ↓{tokenUsage.completion.toLocaleString()}
                            </span>
                        </div>
                        <span className="text-[10px] font-mono" style={{ color: "var(--accent)", opacity: 0.7 }}>
                            ~${estimateCost(tokenUsage)}
                        </span>
                    </div>
                )}

                {/* ── Input area ── */}
                <div className="relative" style={{ borderTop: "1px solid var(--border)" }}>
                    <div className="max-w-3xl mx-auto px-6 py-4">
                        <ChatInput input={input} handleInputChange={handleInputChange} handleSubmit={handleSubmit} isLoading={isLoading} />
                    </div>
                </div>
            </div>
        </div>
    );
}
