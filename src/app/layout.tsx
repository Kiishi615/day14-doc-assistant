import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono", display: "swap" });

export const metadata: Metadata = {
    title: "DocAssist — Chat With Your Documents",
    description: "Upload PDFs, EPUBs, DOCX, TXT, or Markdown files and ask questions. Powered by AI.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
            <body className="bg-background text-primary-text font-sans antialiased">{children}</body>
        </html>
    );
}
