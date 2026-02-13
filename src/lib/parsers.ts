import JSZip from "jszip";

export async function parsePDF(buffer: Buffer): Promise<string> {
    const pdfParse = (await import("pdf-parse")).default;
    const data = await pdfParse(buffer);
    return data.text;
}

export async function parseDOCX(buffer: Buffer): Promise<string> {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
}

export async function parseEPUB(buffer: Buffer): Promise<string> {
    const zip = await JSZip.loadAsync(buffer);
    const containerXml = await zip.file("META-INF/container.xml")?.async("string");
    if (!containerXml) throw new Error("Invalid EPUB: missing container.xml");

    const opfPathMatch = containerXml.match(/full-path="([^"]+)"/);
    if (!opfPathMatch) throw new Error("Invalid EPUB: no rootfile path");
    const opfPath = opfPathMatch[1];
    const opfXml = await zip.file(opfPath)?.async("string");
    if (!opfXml) throw new Error("Invalid EPUB: missing OPF file");

    const opfDir = opfPath.includes("/") ? opfPath.substring(0, opfPath.lastIndexOf("/") + 1) : "";

    // Parse manifest — flexible attribute matching (handles id/href in any order)
    const manifest = new Map<string, string>();
    const itemRegex = /<item\s[^>]*?>/gi;
    let match;
    while ((match = itemRegex.exec(opfXml)) !== null) {
        const tag = match[0];
        const idMatch = tag.match(/\bid="([^"]*)"/);
        const hrefMatch = tag.match(/\bhref="([^"]*)"/);
        if (idMatch && hrefMatch) {
            manifest.set(idMatch[1], hrefMatch[1]);
        }
    }

    // Parse spine — handles both self-closing <itemref .../> and <itemref ...></itemref>
    const spineIds: string[] = [];
    const itemrefRegex = /<itemref\s[^>]*?>/gi;
    while ((match = itemrefRegex.exec(opfXml)) !== null) {
        const tag = match[0];
        const idrefMatch = tag.match(/\bidref="([^"]*)"/);
        if (idrefMatch) {
            spineIds.push(idrefMatch[1]);
        }
    }

    console.log(`📖 EPUB manifest: ${manifest.size} items, spine: ${spineIds.length} items`);

    // Read content files from spine
    const textParts: string[] = [];
    for (const id of spineIds) {
        const href = manifest.get(id);
        if (!href) continue;
        const decodedHref = decodeURIComponent(href);
        const content = await zip.file(opfDir + decodedHref)?.async("string");
        if (content) {
            const text = stripHtml(content);
            if (text.length > 10) textParts.push(text);
        }
    }

    // Fallback: if spine parsing got nothing, scan ALL html/xhtml files in the zip
    if (textParts.length === 0) {
        console.log("⚠️ EPUB spine empty, scanning all HTML/XHTML files as fallback");
        const htmlFiles = Object.keys(zip.files)
            .filter((f) => /\.(x?html?|htm)$/i.test(f))
            .sort();
        for (const f of htmlFiles) {
            const content = await zip.file(f)?.async("string");
            if (content) {
                const text = stripHtml(content);
                if (text.length > 10) textParts.push(text);
            }
        }
    }

    console.log(`📖 EPUB extracted ${textParts.length} sections, ${textParts.reduce((a, b) => a + b.length, 0)} chars`);
    return textParts.join("\n\n");
}

export function parsePlainText(buffer: Buffer): string {
    return buffer.toString("utf-8");
}

export async function parseDocument(buffer: Buffer, fileName: string): Promise<string> {
    const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
    switch (ext) {
        case "pdf": return parsePDF(buffer);
        case "docx": return parseDOCX(buffer);
        case "epub": return parseEPUB(buffer);
        case "txt": case "md": return parsePlainText(buffer);
        default: throw new Error(`Unsupported file format: .${ext}`);
    }
}

function stripHtml(html: string): string {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
        .replace(/\s+/g, " ").trim();
}
