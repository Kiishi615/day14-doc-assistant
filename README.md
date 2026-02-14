# DocAssist

A full-stack RAG (Retrieval-Augmented Generation) document assistant. Upload documents, ask questions, get AI-powered answers grounded in your content.

Built with **Next.js 14**, **GPT-4o Mini**, **OpenAI Embeddings**, and **Pinecone**.

---

## Features

- **Multi-format uploads** — PDF, EPUB, DOCX, TXT, Markdown
- **Parent-child chunking** — Small child chunks are embedded for precise search, larger parent chunks are returned as context for richer answers
- **Conversational memory** — Progressive chat summarization compresses older messages into a running summary, preventing token explosion while preserving full conversation context
- **Query reformulation** — Follow-up questions are rewritten into standalone queries using conversation summary + recent messages
- **Streaming responses** — AI answers stream in real-time via manual `ReadableStream` handling
- **Multiple conversations** — Switch between chats, each with their own context and history
- **Token & cost tracking** — Live display of prompt/completion tokens and estimated cost
- **Conversation export** — Download chats as Markdown or JSON
- **Session isolation** — Each session uses a separate Pinecone namespace
- **LocalStorage persistence** — Conversations survive browser refreshes
- **Premium dark UI** — Warm amber/gold design system with glassmorphism, animations, and depth

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| LLM | GPT-4o Mini (OpenAI) |
| Embeddings | `text-embedding-3-small` (OpenAI) |
| Vector DB | Pinecone |
| Styling | Tailwind CSS + custom design system |
| Animations | Framer Motion |
| Doc Parsing | `pdf-parse`, `mammoth`, `jszip` |

## Getting Started

### Prerequisites

- Node.js 18+
- An [OpenAI API key](https://platform.openai.com/api-keys)
- A [Pinecone API key](https://app.pinecone.io/) with an index created (dimension: `1536`, metric: `cosine`)

### Install

```bash
git clone https://github.com/Kiishi615/day14-doc-assistant.git
cd day14-doc-assistant
npm install
```

### Configure

Create a `.env.local` file in the project root:

```env
OPENAI_API_KEY=sk-...
PINECONE_API_KEY=pcsk_...
PINECONE_INDEX_NAME=doc-assistant
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How It Works

```
Upload → Parse → Parent-Child Chunk → Embed Children → Store in Pinecone
                                                              ↓
Question → Summarize Overflow → Reformulate with Summary → Embed → Search Children
                                                                         ↓
                                                              Retrieve Parent Chunks
                                                                         ↓
                                              GPT-4o Mini + Parents + Summary → Stream Answer
```

### Ingestion
1. **Upload**: Documents are parsed server-side into plain text
2. **Parent-child chunk**: Text → large parent chunks (2000 chars) → small child chunks (400 chars)
3. **Embed**: Child chunks are embedded via `text-embedding-3-small`
4. **Store**: Child vectors are upserted into Pinecone with parent text in metadata

### Query
5. **Summarize**: If chat exceeds 3 turns, older messages are compressed into a running summary
6. **Reformulate**: Follow-up questions are rewritten into standalone queries using summary + recent messages
7. **Search**: Reformulated query is embedded and matched against child chunks in Pinecone
8. **Retrieve parents**: Matched children are deduplicated by parent ID, parent texts returned
9. **Answer**: Parent context + summary + recent messages are sent to GPT-4o Mini, which streams a grounded response

### Memory Management
```
Turn 1-3:  All messages fit in recent window → no summarization needed
Turn 4+:   Older messages overflow → incrementally summarized → summary used in prompts

Messages: [u1,a1,u2,a2,u3,a3,u4,a4, u5]
           ├── summarized ──┤├── recent window ──┤  ↑ current
           compressed to ~200 words   kept verbatim
```

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── chat/route.ts      # Chat with memory, reformulation + streaming
│   │   ├── upload/route.ts    # Document upload + parse + embed + upsert
│   │   └── session/route.ts   # Session cleanup (delete namespace)
│   ├── globals.css            # Design system (amber/gold palette)
│   ├── layout.tsx             # Root layout with fonts
│   └── page.tsx               # Multi-conversation state + memory management
├── components/
│   ├── ChatView.tsx           # Chat UI with token display + clear + export
│   ├── ChatInput.tsx          # Message input with char counter
│   ├── MessageBubble.tsx      # User/AI message bubbles
│   ├── Sidebar.tsx            # Conversation list + document list
│   ├── UploadView.tsx         # Hero upload screen
│   └── ExportButton.tsx       # Markdown/JSON export dropdown
└── lib/
    ├── chunker.ts             # Parent-child chunking with overlap
    ├── embeddings.ts          # OpenAI embedding wrapper
    ├── parsers.ts             # PDF, EPUB, DOCX, TXT parsers
    └── pinecone.ts            # Pinecone client wrapper
```

## Deploy to Vercel

```bash
npx vercel
```

Add environment variables in the Vercel dashboard under **Settings → Environment Variables**.

## License

MIT
