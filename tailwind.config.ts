import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./src/app/**/*.{ts,tsx}",
        "./src/components/**/*.{ts,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ["var(--font-inter)", "system-ui", "sans-serif"],
                mono: ["var(--font-jetbrains-mono)", "Menlo", "monospace"],
            },
            colors: {
                background: "#0a0a0c",
                surface: {
                    DEFAULT: "#141417",
                    hi: "#1c1c20",
                },
                accent: {
                    DEFAULT: "#d4a04a",
                    hi: "#e4b45c",
                    dim: "rgba(212,160,74,0.12)",
                },
                "primary-text": "#e8e6e1",
                "secondary-text": "#8a877f",
                "muted-text": "#504e49",
                "faint-text": "#363430",
            },
        },
    },
    plugins: [],
};

export default config;
