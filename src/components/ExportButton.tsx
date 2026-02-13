"use client";

import { useState, useRef, useEffect } from "react";
import { Download, FileText, Braces } from "lucide-react";
import type { Message, TokenUsage } from "@/app/page";

interface Props {
    messages: Message[];
    tokenUsage: TokenUsage;
    conversationTitle: string;
}

export default function ExportButton({ messages, tokenUsage, conversationTitle }: Props) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    const download = (content: string, filename: string, mime: string) => {
        const blob = new Blob([content], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        setOpen(false);
    };

    const exportMarkdown = () => {
        const date = new Date().toLocaleString();
        const lines = [
            `# ${conversationTitle}`,
            `_Exported on ${date}_\n`,
            `---\n`,
        ];

        for (const msg of messages) {
            const label = msg.role === "user" ? "🧑 You" : "🤖 DocAssist";
            lines.push(`### ${label}\n`);
            lines.push(`${msg.content}\n`);
        }

        lines.push(`---\n`);
        lines.push(`## Token Usage\n`);
        lines.push(`| Metric | Count |`);
        lines.push(`|--------|-------|`);
        lines.push(`| Prompt tokens | ${tokenUsage.prompt.toLocaleString()} |`);
        lines.push(`| Completion tokens | ${tokenUsage.completion.toLocaleString()} |`);
        lines.push(`| Total tokens | ${tokenUsage.total.toLocaleString()} |`);
        lines.push(`| Estimated cost | $${estimateCost(tokenUsage)} |`);

        const slug = conversationTitle.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30);
        download(lines.join("\n"), `docassist_${slug}.md`, "text/markdown");
    };

    const exportJSON = () => {
        const data = {
            title: conversationTitle,
            exportedAt: new Date().toISOString(),
            messages: messages.map((m) => ({ role: m.role, content: m.content })),
            tokenUsage,
            estimatedCost: estimateCost(tokenUsage),
        };
        const slug = conversationTitle.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30);
        download(JSON.stringify(data, null, 2), `docassist_${slug}.json`, "application/json");
    };

    if (messages.length === 0) return null;

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen(!open)}
                className="p-2 rounded-lg transition-all"
                style={{
                    background: open ? "rgba(255,255,255,0.06)" : "transparent",
                    color: "var(--text-2)",
                }}
                title="Export conversation"
            >
                <Download className="w-4 h-4" />
            </button>

            {open && (
                <div className="absolute right-0 top-full mt-2 glass-strong rounded-xl overflow-hidden z-50 min-w-[180px]"
                    style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}
                >
                    <button
                        onClick={exportMarkdown}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm transition-all"
                        style={{ color: "var(--text)" }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                        <FileText className="w-4 h-4" style={{ color: "var(--accent)" }} />
                        Markdown
                    </button>
                    <div style={{ height: "1px", background: "var(--border)" }} />
                    <button
                        onClick={exportJSON}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm transition-all"
                        style={{ color: "var(--text)" }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                        <Braces className="w-4 h-4" style={{ color: "var(--accent)" }} />
                        JSON
                    </button>
                </div>
            )}
        </div>
    );
}

function estimateCost(usage: TokenUsage): string {
    // GPT-4o-mini: $0.15/1M input, $0.60/1M output
    const inputCost = (usage.prompt / 1_000_000) * 0.15;
    const outputCost = (usage.completion / 1_000_000) * 0.60;
    return (inputCost + outputCost).toFixed(4);
}
