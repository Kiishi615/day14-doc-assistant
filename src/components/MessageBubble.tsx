"use client";

import { motion } from "framer-motion";
import { User, Bot } from "lucide-react";

interface Props {
    role: string;
    content: string;
    isStreaming: boolean;
    index: number;
}

export default function MessageBubble({ role, content, isStreaming, index }: Props) {
    const isUser = role === "user";

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.12), ease: "easeOut" }}
            className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
        >
            {/* ── AI avatar with accent tint ── */}
            {!isUser && (
                <div className="w-8 h-8 rounded-xl glass flex items-center justify-center shrink-0 mt-1">
                    <Bot className="w-4 h-4" style={{ color: "var(--accent)", opacity: 0.7 }} />
                </div>
            )}

            {/* ── CONTRAST: User = solid amber, AI = glass ── */}
            <div
                className={`max-w-[78%] px-4 py-3 text-[14px] leading-[1.7] ${isUser
                        ? "rounded-2xl rounded-br-md"
                        : "glass rounded-2xl rounded-bl-md"
                    }`}
                style={isUser ? {
                    background: "linear-gradient(135deg, var(--accent) 0%, #c08a30 100%)",
                    color: "#0a0a0c",
                    boxShadow: "0 2px 20px rgba(212,160,74,0.2)",
                } : undefined}
            >
                <span className={isStreaming ? "streaming-cursor" : ""}>
                    {content || (isStreaming ? "" : " ")}
                </span>
            </div>

            {/* ── User avatar ── */}
            {isUser && (
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-1" style={{ background: "var(--accent-dim)" }}>
                    <User className="w-4 h-4" style={{ color: "var(--accent)" }} />
                </div>
            )}
        </motion.div>
    );
}
