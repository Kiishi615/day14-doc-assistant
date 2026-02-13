import { NextResponse } from "next/server";
import { parseDocument } from "@/lib/parsers";
import { parentChildChunk } from "@/lib/chunker";
import { embedTexts } from "@/lib/embeddings";
import { upsertChunks } from "@/lib/pinecone";
import { v4 as uuidv4 } from "uuid";

export const maxDuration = 60;

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        const sessionId = formData.get("sessionId") as string | null;

        if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
        if (!sessionId) return NextResponse.json({ error: "No sessionId provided" }, { status: 400 });

        const buffer = Buffer.from(await file.arrayBuffer());
        const fileName = file.name;
        const fileSize = file.size;

        // 1. Parse document to text
        const text = await parseDocument(buffer, fileName);
        if (!text.trim()) {
            return NextResponse.json({ error: "Could not extract text from file" }, { status: 400 });
        }

        // 2. Parent-child chunking
        //    Parents = 2000 chars (returned as context)
        //    Children = 400 chars (embedded for search)
        const { parents, children } = parentChildChunk(text, 2000, 200, 400, 50);
        console.log(`📄 ${fileName}: ${parents.length} parents, ${children.length} children`);

        // Build parent lookup
        const parentMap = new Map(parents.map((p) => [p.id, p.text]));

        // 3. Embed CHILD chunks (small = precise search)
        const childTexts = children.map((c) => c.text);
        const embeddings = await embedTexts(childTexts);

        // 4. Upsert children to Pinecone with parent text in metadata
        const docId = uuidv4();
        const vectors = children.map((child, i) => ({
            id: `${docId}-c${i}`,
            values: embeddings[i],
            metadata: {
                text: child.text,
                parentText: parentMap.get(child.parentId) ?? child.text,
                parentId: child.parentId,
                childIndex: child.childIndex,
                source: fileName,
                chunkIndex: child.index,
                docId,
            },
        }));

        await upsertChunks(sessionId, vectors);

        return NextResponse.json({
            id: docId,
            fileName,
            chunkCount: children.length,
            parentCount: parents.length,
            fileSize,
        });
    } catch (error) {
        console.error("Upload error:", error);
        const message = error instanceof Error ? error.message : "Upload failed";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
