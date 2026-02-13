import OpenAI from "openai";

const MODEL = "text-embedding-3-small";
const BATCH_SIZE = 100;

// Lazy-init to avoid crash during Vercel build (no env vars at build time)
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
    if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    return _openai;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
    const all: number[][] = [];
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
        const batch = texts.slice(i, i + BATCH_SIZE);
        const res = await getOpenAI().embeddings.create({ model: MODEL, input: batch });
        for (const item of res.data) all.push(item.embedding);
    }
    return all;
}

export async function embedText(text: string): Promise<number[]> {
    const [embedding] = await embedTexts([text]);
    return embedding;
}
