export interface ParentChunk {
    id: string;
    text: string;
    index: number;
}

export interface ChildChunk {
    text: string;
    index: number;
    parentId: string;
    childIndex: number;
}

const SEPARATORS = ["\n\n", "\n", ". ", " ", ""];

/**
 * Parent-child chunking strategy:
 * 1. Split text into LARGE parent chunks (2000 chars, 200 overlap)
 * 2. Split each parent into SMALL child chunks (400 chars, 50 overlap)
 * 3. Child chunks are embedded for precise search
 * 4. Parent chunks are returned as context for richer answers
 */
export function parentChildChunk(
    text: string,
    parentSize: number = 2000,
    parentOverlap: number = 200,
    childSize: number = 400,
    childOverlap: number = 50
): { parents: ParentChunk[]; children: ChildChunk[] } {
    // Step 1: Create parent chunks
    const parentTexts = splitAndMerge(text, parentSize, parentOverlap);
    const parents: ParentChunk[] = parentTexts.map((t, i) => ({
        id: `p-${i}`,
        text: t,
        index: i,
    }));

    // Step 2: Split each parent into children
    const children: ChildChunk[] = [];
    for (const parent of parents) {
        const childTexts = splitAndMerge(parent.text, childSize, childOverlap);
        for (let ci = 0; ci < childTexts.length; ci++) {
            children.push({
                text: childTexts[ci],
                index: children.length,
                parentId: parent.id,
                childIndex: ci,
            });
        }
    }

    return { parents, children };
}

// ── Legacy single-level chunking (kept for backward compat) ──

export interface Chunk {
    text: string;
    index: number;
}

export function chunkText(
    text: string,
    chunkSize: number = 1000,
    chunkOverlap: number = 200
): Chunk[] {
    const merged = splitAndMerge(text, chunkSize, chunkOverlap);
    return merged.map((t, i) => ({ text: t, index: i }));
}

// ── Internal helpers ──

function splitAndMerge(text: string, chunkSize: number, overlap: number): string[] {
    const rawChunks = splitRecursive(text, SEPARATORS, chunkSize);
    return mergeChunks(rawChunks, chunkSize, overlap);
}

function splitRecursive(text: string, separators: string[], chunkSize: number): string[] {
    if (text.length <= chunkSize) return [text];
    if (separators.length === 0) {
        const parts: string[] = [];
        for (let i = 0; i < text.length; i += chunkSize) parts.push(text.slice(i, i + chunkSize));
        return parts;
    }

    const sep = separators[0];
    const rest = separators.slice(1);
    const splits = sep === "" ? [text] : text.split(sep);
    const results: string[] = [];
    let current = "";

    for (const piece of splits) {
        const candidate = current ? current + sep + piece : piece;
        if (candidate.length <= chunkSize) {
            current = candidate;
        } else {
            if (current) results.push(current);
            if (piece.length > chunkSize) {
                results.push(...splitRecursive(piece, rest, chunkSize));
                current = "";
            } else {
                current = piece;
            }
        }
    }
    if (current) results.push(current);
    return results;
}

function mergeChunks(splits: string[], chunkSize: number, overlap: number): string[] {
    if (splits.length <= 1) return splits.map((s) => s.trim()).filter(Boolean);
    const result: string[] = [];
    let i = 0;

    while (i < splits.length) {
        let chunk = splits[i].trim();
        while (i + 1 < splits.length && chunk.length + splits[i + 1].length + 1 <= chunkSize) {
            i++;
            chunk += " " + splits[i].trim();
        }
        if (chunk) result.push(chunk);
        i++;
    }

    if (overlap > 0 && result.length > 1) {
        const overlapped: string[] = [result[0]];
        for (let j = 1; j < result.length; j++) {
            const tail = result[j - 1].slice(-overlap);
            overlapped.push(tail + " " + result[j]);
        }
        return overlapped;
    }
    return result;
}
