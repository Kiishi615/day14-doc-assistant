"use client";

import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { FileText, Plus, LogOut, Loader2, Check, MessageSquare, Trash2 } from "lucide-react";
import type { DocumentInfo, Conversation } from "@/app/page";

interface Props {
    documents: DocumentInfo[];
    onToggleDocument: (id: string) => void;
    onUploadMore: (docs: DocumentInfo[]) => void;
    onEndSession: () => void;
    sessionId: string;
    conversations: Conversation[];
    activeConversationId: string;
    onNewConversation: () => void;
    onSwitchConversation: (id: string) => void;
    onDeleteConversation: (id: string) => void;
}

function formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function timeAgo(ts: number): string {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
}

export default function Sidebar({
    documents, onToggleDocument, onUploadMore, onEndSession, sessionId,
    conversations, activeConversationId, onNewConversation, onSwitchConversation, onDeleteConversation,
}: Props) {
    const fileRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);

    const handleUpload = useCallback(
        async (files: FileList) => {
            setUploading(true);
            const uploaded: DocumentInfo[] = [];
            for (const file of Array.from(files)) {
                const fd = new FormData();
                fd.append("file", file);
                fd.append("sessionId", sessionId);
                try {
                    const res = await fetch("/api/upload", { method: "POST", body: fd });
                    if (res.ok) {
                        const data = await res.json();
                        uploaded.push({ id: data.id, name: data.fileName, chunkCount: data.chunkCount, fileSize: data.fileSize, selected: true });
                    }
                } catch { /* skip */ }
            }
            setUploading(false);
            if (uploaded.length > 0) onUploadMore(uploaded);
        },
        [sessionId, onUploadMore]
    );

    return (
        <div className="w-[280px] glass-strong flex flex-col h-full shrink-0" style={{ borderRight: "1px solid var(--border)" }}>

            {/* ── Header ── */}
            <div className="p-5 pb-4">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "var(--accent-dim)" }}>
                        <FileText className="w-4.5 h-4.5" style={{ color: "var(--accent)" }} />
                    </div>
                    <div>
                        <h2 className="text-[15px] font-semibold tracking-tight" style={{ color: "var(--text)" }}>DocAssist</h2>
                        <p className="text-[10px] font-mono tracking-[0.15em] uppercase" style={{ color: "var(--text-3)" }}>Workspace</p>
                    </div>
                </div>
            </div>

            <div className="mx-4" style={{ height: "1px", background: "var(--border)" }} />

            {/* ── Conversations ── */}
            <div className="p-3 pb-1">
                <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-mono tracking-[0.15em] uppercase px-1" style={{ color: "var(--text-3)" }}>Chats</p>
                    <button
                        onClick={onNewConversation}
                        className="p-1.5 rounded-lg transition-all"
                        style={{ color: "var(--accent)" }}
                        title="New conversation"
                    >
                        <Plus className="w-3.5 h-3.5" />
                    </button>
                </div>
                <div className="space-y-0.5 max-h-[180px] overflow-y-auto">
                    {conversations.map((conv) => {
                        const isActive = conv.id === activeConversationId;
                        return (
                            <div
                                key={conv.id}
                                onClick={() => onSwitchConversation(conv.id)}
                                className="group flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-all"
                                style={{
                                    background: isActive ? "var(--accent-dim)" : "transparent",
                                    border: isActive ? "1px solid rgba(212,160,74,0.15)" : "1px solid transparent",
                                }}
                            >
                                <MessageSquare className="w-3.5 h-3.5 shrink-0" style={{ color: isActive ? "var(--accent)" : "var(--text-3)" }} />
                                <div className="min-w-0 flex-1">
                                    <p className="text-[12px] truncate" style={{ color: isActive ? "var(--text)" : "var(--text-2)" }}>
                                        {conv.title}
                                    </p>
                                    <p className="text-[10px] font-mono" style={{ color: "var(--text-4)" }}>
                                        {conv.messages.length > 0 ? `${Math.ceil(conv.messages.length / 2)} msgs` : "empty"} · {timeAgo(conv.createdAt)}
                                    </p>
                                </div>
                                {conversations.length > 1 && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onDeleteConversation(conv.id); }}
                                        className="opacity-0 group-hover:opacity-100 p-1 rounded transition-all"
                                        style={{ color: "var(--text-3)" }}
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="mx-4" style={{ height: "1px", background: "var(--border)" }} />

            {/* ── Documents ── */}
            <div className="p-3 pb-1">
                <p className="text-[10px] font-mono tracking-[0.15em] uppercase px-1 mb-2" style={{ color: "var(--text-3)" }}>Documents</p>
            </div>
            <div className="flex-1 overflow-y-auto px-3 space-y-1.5">
                {documents.map((doc, i) => (
                    <motion.div
                        key={doc.id}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05, duration: 0.3, ease: "easeOut" }}
                        onClick={() => onToggleDocument(doc.id)}
                        className="group p-3 rounded-xl cursor-pointer transition-all duration-200"
                        style={{
                            background: doc.selected ? "var(--accent-dim)" : "rgba(255,255,255,0.015)",
                            border: doc.selected ? "1px solid rgba(212,160,74,0.18)" : "1px solid transparent",
                        }}
                    >
                        <div className="flex items-start gap-2.5">
                            <div
                                className="w-4 h-4 rounded mt-0.5 flex items-center justify-center shrink-0 transition-all duration-200"
                                style={doc.selected
                                    ? { background: "var(--accent)", boxShadow: "0 0 8px rgba(212,160,74,0.3)" }
                                    : { border: "1.5px solid var(--text-3)" }
                                }
                            >
                                {doc.selected && <Check className="w-2.5 h-2.5 text-black" strokeWidth={3} />}
                            </div>
                            <div className="min-w-0">
                                <p className="text-[13px] font-medium truncate leading-tight" style={{ color: "var(--text)" }}>{doc.name}</p>
                                <p className="text-[11px] font-mono mt-1.5 flex items-center" style={{ color: "var(--text-3)" }}>
                                    <span>{doc.chunkCount} chunks</span>
                                    <span className="dot-sep">{formatSize(doc.fileSize)}</span>
                                </p>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* ── Actions ── */}
            <div className="p-3 space-y-2">
                <div style={{ height: "1px", background: "var(--border)" }} className="mb-3" />
                <input ref={fileRef} type="file" accept=".pdf,.epub,.docx,.txt,.md" multiple onChange={(e) => e.target.files && handleUpload(e.target.files)} className="hidden" />

                <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-40"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", color: "var(--text-2)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                >
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    {uploading ? "Uploading..." : "Upload More"}
                </button>

                <button
                    onClick={onEndSession}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                    style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.1)", color: "rgba(239,68,68,0.6)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.1)"; e.currentTarget.style.color = "rgba(239,68,68,0.8)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.05)"; e.currentTarget.style.color = "rgba(239,68,68,0.6)"; }}
                >
                    <LogOut className="w-3.5 h-3.5" />
                    End Session
                </button>
            </div>
        </div>
    );
}
