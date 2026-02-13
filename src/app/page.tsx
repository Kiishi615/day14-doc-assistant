"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import UploadView from "@/components/UploadView";
import ChatView from "@/components/ChatView";

export interface DocumentInfo {
    id: string;
    name: string;
    chunkCount: number;
    fileSize: number;
    selected: boolean;
}

export interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
}

export interface TokenUsage {
    prompt: number;
    completion: number;
    total: number;
}

export interface Conversation {
    id: string;
    title: string;
    sessionId: string;
    messages: Message[];
    documents: DocumentInfo[];
    tokenUsage: TokenUsage;
    summary: string;
    summaryMsgCount: number;
    createdAt: number;
}

const STORAGE_KEY = "docassist_conversations";
const ACTIVE_KEY = "docassist_active_conversation";

function loadConversations(): Conversation[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function saveConversations(convos: Conversation[]) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(convos));
    } catch { /* quota exceeded — best effort */ }
}

function loadActiveId(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(ACTIVE_KEY);
}

function saveActiveId(id: string) {
    localStorage.setItem(ACTIVE_KEY, id);
}

function createConversation(): Conversation {
    return {
        id: crypto.randomUUID(),
        title: "New Chat",
        sessionId: crypto.randomUUID(),
        messages: [],
        documents: [],
        tokenUsage: { prompt: 0, completion: 0, total: 0 },
        summary: "",
        summaryMsgCount: 0,
        createdAt: Date.now(),
    };
}

export default function Home() {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeId, setActiveId] = useState<string>("");
    const [initialized, setInitialized] = useState(false);
    const skipSave = useRef(false);

    // Load from localStorage on mount
    useEffect(() => {
        let convos = loadConversations();
        let active = loadActiveId();

        if (convos.length === 0) {
            const first = createConversation();
            convos = [first];
            active = first.id;
        } else if (!active || !convos.find((c) => c.id === active)) {
            active = convos[0].id;
        }

        skipSave.current = true;
        setConversations(convos);
        setActiveId(active!);
        setInitialized(true);
    }, []);

    // Persist to localStorage on changes
    useEffect(() => {
        if (!initialized) return;
        if (skipSave.current) {
            skipSave.current = false;
            return;
        }
        saveConversations(conversations);
        saveActiveId(activeId);
    }, [conversations, activeId, initialized]);

    const active = conversations.find((c) => c.id === activeId);

    // ── Conversation actions ──

    const handleNewConversation = useCallback(() => {
        const c = createConversation();
        setConversations((prev) => [c, ...prev]);
        setActiveId(c.id);
    }, []);

    const handleSwitchConversation = useCallback((id: string) => {
        setActiveId(id);
    }, []);

    const handleDeleteConversation = useCallback((id: string) => {
        setConversations((prev) => {
            const next = prev.filter((c) => c.id !== id);
            if (next.length === 0) {
                const fresh = createConversation();
                setActiveId(fresh.id);
                return [fresh];
            }
            if (id === activeId) {
                setActiveId(next[0].id);
            }
            return next;
        });
    }, [activeId]);

    // ── Mutate active conversation ──

    const updateActive = useCallback((fn: (c: Conversation) => Conversation) => {
        setConversations((prev) => prev.map((c) => (c.id === activeId ? fn(c) : c)));
    }, [activeId]);

    const handleUploadComplete = useCallback((newDocs: DocumentInfo[]) => {
        updateActive((c) => ({ ...c, documents: [...c.documents, ...newDocs] }));
    }, [updateActive]);

    const handleToggleDocument = useCallback((docId: string) => {
        updateActive((c) => ({
            ...c,
            documents: c.documents.map((d) => (d.id === docId ? { ...d, selected: !d.selected } : d)),
        }));
    }, [updateActive]);

    const handleSetMessages = useCallback((messages: Message[]) => {
        updateActive((c) => {
            // Auto-title from first user message
            const firstUser = messages.find((m) => m.role === "user");
            const title = firstUser ? firstUser.content.slice(0, 40) + (firstUser.content.length > 40 ? "…" : "") : c.title;
            return { ...c, messages, title };
        });
    }, [updateActive]);

    const handleAddTokens = useCallback((usage: TokenUsage) => {
        updateActive((c) => ({
            ...c,
            tokenUsage: {
                prompt: c.tokenUsage.prompt + usage.prompt,
                completion: c.tokenUsage.completion + usage.completion,
                total: c.tokenUsage.total + usage.total,
            },
        }));
    }, [updateActive]);

    const handleClearHistory = useCallback(() => {
        updateActive((c) => ({
            ...c,
            messages: [],
            tokenUsage: { prompt: 0, completion: 0, total: 0 },
            summary: "",
            summaryMsgCount: 0,
            title: "New Chat",
        }));
    }, [updateActive]);

    const handleUpdateSummary = useCallback((summary: string, msgCount: number) => {
        updateActive((c) => ({ ...c, summary, summaryMsgCount: msgCount }));
    }, [updateActive]);

    const handleEndSession = useCallback(async () => {
        if (!active) return;
        try {
            await fetch("/api/session", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionId: active.sessionId }),
            });
        } catch { /* best-effort */ }
        handleDeleteConversation(active.id);
    }, [active, handleDeleteConversation]);

    if (!initialized || !active) return null;

    const hasDocuments = active.documents.length > 0;

    return (
        <main className="h-screen overflow-hidden">
            <AnimatePresence mode="wait">
                {!hasDocuments ? (
                    <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="h-full">
                        <UploadView sessionId={active.sessionId} onUploadComplete={handleUploadComplete} />
                    </motion.div>
                ) : (
                    <motion.div key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="h-full">
                        <ChatView
                            sessionId={active.sessionId}
                            documents={active.documents}
                            messages={active.messages}
                            tokenUsage={active.tokenUsage}
                            summary={active.summary}
                            summaryMsgCount={active.summaryMsgCount}
                            conversations={conversations}
                            activeConversationId={activeId}
                            onToggleDocument={handleToggleDocument}
                            onUploadMore={handleUploadComplete}
                            onEndSession={handleEndSession}
                            onSetMessages={handleSetMessages}
                            onAddTokens={handleAddTokens}
                            onClearHistory={handleClearHistory}
                            onUpdateSummary={handleUpdateSummary}
                            onNewConversation={handleNewConversation}
                            onSwitchConversation={handleSwitchConversation}
                            onDeleteConversation={handleDeleteConversation}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </main>
    );
}
