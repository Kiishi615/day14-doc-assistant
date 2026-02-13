import { Pinecone } from "@pinecone-database/pinecone";

const INDEX_NAME = process.env.PINECONE_INDEX_NAME ?? "doc-assistant";
let _pinecone: Pinecone | null = null;

function getPinecone(): Pinecone {
    if (!_pinecone) _pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
    return _pinecone;
}

function getIndex() {
    return getPinecone().index(INDEX_NAME);
}

export async function upsertChunks(
    namespace: string,
    chunks: { id: string; values: number[]; metadata: Record<string, string | number | boolean | string[]> }[]
): Promise<void> {
    const index = getIndex().namespace(namespace);
    const BATCH = 100;
    for (let i = 0; i < chunks.length; i += BATCH) {
        await index.upsert(chunks.slice(i, i + BATCH));
    }
}

export async function queryChunks(
    namespace: string,
    vector: number[],
    topK: number = 10,
    filter?: Record<string, unknown>
) {
    const index = getIndex().namespace(namespace);
    const result = await index.query({ vector, topK, includeMetadata: true, filter });
    return (result.matches ?? []).map((m) => ({
        id: m.id,
        score: m.score ?? 0,
        metadata: (m.metadata ?? {}) as Record<string, string | number>,
    }));
}

export async function deleteNamespace(namespace: string): Promise<void> {
    const index = getIndex().namespace(namespace);
    await index.deleteAll();
}
