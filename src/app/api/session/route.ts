import { NextResponse } from "next/server";
import { deleteNamespace } from "@/lib/pinecone";

export async function DELETE(req: Request) {
    try {
        const { sessionId } = await req.json();
        if (!sessionId) {
            return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
        }

        await deleteNamespace(sessionId);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Session cleanup error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Session cleanup failed" },
            { status: 500 }
        );
    }
}
