"use client";

import { Send } from "lucide-react";
import { type ChangeEvent, type FormEvent } from "react";

interface Props {
    input: string;
    handleInputChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
    handleSubmit: (e?: FormEvent) => void;
    isLoading: boolean;
}

const MAX_LEN = 500;

export default function ChatInput({ input, handleInputChange, handleSubmit, isLoading }: Props) {
    const remaining = MAX_LEN - input.length;
    const isOverLimit = remaining < 0;

    const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (input.trim() && !isLoading && !isOverLimit) {
                handleSubmit();
            }
        }
    };

    return (
        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="relative">
            <div className="flex items-end gap-2 glass rounded-2xl p-2 focus-ring transition-all">
                <textarea
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={onKeyDown}
                    placeholder="Ask about your documents..."
                    maxLength={MAX_LEN + 50}
                    rows={1}
                    disabled={isLoading}
                    className="flex-1 bg-transparent text-sm resize-none outline-none px-3 py-2.5 min-h-[42px] max-h-[160px] disabled:opacity-40"
                    style={{ color: "var(--text)", fontFamily: "inherit" }}
                    onInput={(e) => {
                        const t = e.currentTarget;
                        t.style.height = "auto";
                        t.style.height = Math.min(t.scrollHeight, 160) + "px";
                    }}
                />
                <button
                    type="submit"
                    disabled={isLoading || !input.trim() || isOverLimit}
                    className="p-2.5 rounded-xl text-black transition-all disabled:opacity-15 disabled:cursor-not-allowed shrink-0"
                    style={{
                        background: "var(--accent)",
                        boxShadow: "0 0 14px rgba(212,160,74,0.15)",
                    }}
                >
                    <Send className="w-4 h-4" />
                </button>
            </div>
            <div className="flex justify-end mt-1.5 pr-1">
                <span
                    className="text-[10px] font-mono tracking-wider"
                    style={{ color: isOverLimit ? "#ef4444" : remaining < 50 ? "#eab308" : "var(--text-4)" }}
                >
                    {input.length}/{MAX_LEN}
                </span>
            </div>
        </form>
    );
}
