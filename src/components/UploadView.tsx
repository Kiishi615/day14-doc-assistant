"use client";

import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Upload, Loader2 } from "lucide-react";
import type { DocumentInfo } from "@/app/page";

interface Props {
    sessionId: string;
    onUploadComplete: (docs: DocumentInfo[]) => void;
}

const FORMATS = ["PDF", "EPUB", "DOCX", "TXT", "MD"];
const ACCEPT = ".pdf,.epub,.docx,.txt,.md";

/* ── Staggered letter animation ── */
const letterVariants = {
    hidden: { opacity: 0, y: 50, rotateX: -40 },
    visible: (i: number) => ({
        opacity: 1,
        y: 0,
        rotateX: 0,
        transition: {
            delay: 0.4 + i * 0.055,
            duration: 0.7,
            ease: [0.215, 0.61, 0.355, 1],
        },
    }),
};

/* ── Fade up with custom delay ── */
const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    visible: (delay: number) => ({
        opacity: 1,
        y: 0,
        transition: { delay, duration: 0.65, ease: [0.215, 0.61, 0.355, 1] },
    }),
};

export default function UploadView({ sessionId, onUploadComplete }: Props) {
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [progress, setProgress] = useState("");
    const [error, setError] = useState("");
    const fileRef = useRef<HTMLInputElement>(null);

    const processFiles = useCallback(
        async (files: FileList | File[]) => {
            const arr = Array.from(files).filter((f) => {
                const ext = f.name.split(".").pop()?.toLowerCase();
                return ["pdf", "epub", "docx", "txt", "md"].includes(ext ?? "");
            });
            if (!arr.length) return;
            setIsUploading(true);
            setError("");
            const uploaded: DocumentInfo[] = [];

            for (let i = 0; i < arr.length; i++) {
                const file = arr[i];
                setProgress(`Processing ${file.name} (${i + 1}/${arr.length})`);
                const fd = new FormData();
                fd.append("file", file);
                fd.append("sessionId", sessionId);
                try {
                    const res = await fetch("/api/upload", { method: "POST", body: fd });
                    if (!res.ok) throw new Error((await res.json()).error || "Upload failed");
                    const data = await res.json();
                    uploaded.push({
                        id: data.id,
                        name: data.fileName,
                        chunkCount: data.chunkCount,
                        fileSize: data.fileSize,
                        selected: true,
                    });
                } catch (err) {
                    setError(`${file.name}: ${err instanceof Error ? err.message : "Unknown error"}`);
                    setIsUploading(false);
                    return;
                }
            }
            setIsUploading(false);
            setProgress("");
            onUploadComplete(uploaded);
        },
        [sessionId, onUploadComplete]
    );

    const title = "DocAssist";

    return (
        <div className="h-full relative overflow-hidden">
            {/* Background layers — Pattern + Glow create depth */}
            <div className="absolute inset-0 bg-grid" />
            <div className="absolute inset-0 bg-glow" />

            {/* Content — centered with generous whitespace */}
            <div className="relative h-full flex flex-col items-center justify-center px-6">

                {/* ── EMPHASIS: Large animated title ── */}
                <div className="mb-5 select-none" style={{ perspective: "800px" }}>
                    <h1 className="text-7xl md:text-8xl lg:text-[9rem] font-bold tracking-[-0.04em] leading-none">
                        {title.split("").map((char, i) => (
                            <motion.span
                                key={i}
                                custom={i}
                                initial="hidden"
                                animate="visible"
                                variants={letterVariants}
                                className="inline-block gradient-text"
                                style={{ transformOrigin: "bottom" }}
                            >
                                {char}
                            </motion.span>
                        ))}
                    </h1>
                </div>

                {/* ── HIERARCHY: Subtitle ── */}
                <motion.p
                    custom={1.0}
                    initial="hidden"
                    animate="visible"
                    variants={fadeUp}
                    className="text-lg md:text-xl tracking-wide mb-16 text-center"
                    style={{ color: "var(--text-2)" }}
                >
                    Upload a document. Ask it anything.
                </motion.p>

                {/* ── CONTRAST: Glass upload card ── */}
                <motion.div custom={1.2} initial="hidden" animate="visible" variants={fadeUp} className="w-full max-w-xl">
                    <motion.div
                        whileHover={{ y: -3 }}
                        whileTap={{ scale: 0.995 }}
                        transition={{ type: "spring", stiffness: 260, damping: 18 }}
                    >
                        <div
                            onClick={() => fileRef.current?.click()}
                            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={(e) => { e.preventDefault(); setIsDragging(false); processFiles(e.dataTransfer.files); }}
                            className={`relative cursor-pointer rounded-2xl p-14 text-center transition-all duration-500 ${isDragging
                                    ? "glass glow border-[var(--accent)]/20"
                                    : "glass glow-sm hover:border-[rgba(255,255,255,0.08)]"
                                }`}
                        >
                            <input
                                ref={fileRef} type="file" accept={ACCEPT} multiple
                                onChange={(e) => e.target.files && processFiles(e.target.files)}
                                className="hidden"
                            />

                            {isUploading ? (
                                <div className="flex flex-col items-center gap-5">
                                    <div className="relative">
                                        <Loader2 className="w-10 h-10 animate-spin" style={{ color: "var(--accent)" }} />
                                        <div className="absolute inset-0 blur-2xl rounded-full" style={{ background: "var(--accent-dim)" }} />
                                    </div>
                                    <p className="font-mono text-sm tracking-wide" style={{ color: "var(--text-2)" }}>{progress}</p>
                                </div>
                            ) : (
                                <>
                                    {/* ── PROPORTION: Icon smaller than text ── */}
                                    <div className="mb-7">
                                        <Upload className="w-9 h-9 mx-auto" style={{ color: "var(--text-3)" }} />
                                    </div>
                                    <p className="text-base mb-1" style={{ color: "var(--text)" }}>
                                        Drag & drop files here
                                    </p>
                                    <p className="text-sm mb-9" style={{ color: "var(--text-3)" }}>
                                        or <span className="transition-colors hover:text-[var(--accent)]" style={{ color: "var(--accent-hi)" }}>click to browse</span>
                                    </p>

                                    {/* ── RHYTHM: Evenly spaced badges ── */}
                                    <div className="flex justify-center gap-2.5 flex-wrap">
                                        {FORMATS.map((f, i) => (
                                            <motion.span
                                                key={f}
                                                custom={1.4 + i * 0.07}
                                                initial="hidden"
                                                animate="visible"
                                                variants={fadeUp}
                                                className="format-badge"
                                            >
                                                {f}
                                            </motion.span>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </motion.div>
                </motion.div>

                {/* Error */}
                {error && (
                    <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        className="mt-7 text-red-400/80 text-sm font-mono max-w-xl text-center">
                        {error}
                    </motion.p>
                )}

                {/* ── REPETITION: Footer matches overall tone ── */}
                <motion.p
                    custom={1.8}
                    initial="hidden"
                    animate="visible"
                    variants={fadeUp}
                    className="absolute bottom-8 font-mono text-[10px] tracking-[0.25em] uppercase"
                    style={{ color: "var(--text-4)" }}
                >
                    Pinecone <span className="mx-2">·</span> OpenAI <span className="mx-2">·</span> GPT
                </motion.p>
            </div>
        </div>
    );
}
