# Phase 2: RAG Optimization & SQLite Migration

This phase addresses the structural and scalable limitations of the current NoteForge architecture. We will shift from flat JSON files to a relational database, and optimize AI prompt payload sizes to prevent API token exhaustion on massive playlists.

## User Review Required

> [!WARNING]
> **Data Migration Alert**
> We are migrating away from the `storage/` directory (JSON files) to a local `sqlite` database. Existing notebooks and jobs stored in JSON files will not automatically transfer over to the new database unless we write a migration script. For a development environment, it is usually acceptable to start fresh. Are you okay with starting fresh with the new database?

## Open Questions

> [!IMPORTANT]
> 1. Should we keep the existing Pinecone vector database integration exactly as it is, or do you want to explore moving vector embeddings into a local SQLite vector extension (sqlite-vss) to keep the app 100% local? (Sticking with Pinecone is faster to implement).
> 2. What is the maximum number of chunks (Top-K) you want to pull for a topic during RAG generation? More chunks = more context, but higher token usage. I recommend K=15 as a default.

## Proposed Changes

---

### Database Layer (Prisma & SQLite)

We will integrate Prisma ORM with SQLite for persistent, fast data storage.

#### [NEW] server/prisma/schema.prisma
Define the relational schema:
- `Job`: Tracks processing state, error logs, and video count.
- `Notebook`: The final compiled study guide, containing mind maps, quizzes, and markdown content.
- `TopicIndex`: The unified table of contents.
- `Transcript`: Extracted YouTube captions mapped to video IDs.

#### [MODIFY] server/package.json
- Add `prisma` and `@prisma/client` dependencies.
- Add npm scripts for database generation and migration (`prisma generate`, `prisma db push`).

#### [MODIFY] server/src/services/job.service.ts
- Rip out `fs.readFileSync` and `fs.writeFileSync`.
- Replace with `prisma.job.create`, `prisma.job.update`, `prisma.job.findMany`.

#### [MODIFY] server/src/services/notes.service.ts
- Replace file system operations with `prisma.notebook.upsert` and `prisma.notebook.findUnique`.

---

### AI Optimization (RAG Chunking)

We will stop sending 100% of a video's transcript to the LLM and instead query our vector database for precisely what we need.

#### [MODIFY] server/src/services/rag.service.ts
- Enhance the `query` function to fetch the Top-K relevant transcript chunks based on a specific `topic.title` and `topic.subtopics`.

#### [MODIFY] server/src/services/notes.service.ts
- Inside `generateTopicNotes`, instead of mapping over all transcripts and appending them raw, we will:
  1. Call `ragService.query(topic.title)` to get the most relevant snippets.
  2. Assemble a highly dense, token-efficient context block.
  3. Feed this filtered context block to Gemini/Ollama.

## Verification Plan

### Automated Tests
- Run `npx prisma db push` to verify the schema compiles and the SQLite file is created successfully.

### Manual Verification
- Start a new playlist job.
- Verify in the server console that Prisma is successfully writing job states to the database instead of `storage/jobs`.
- Monitor the backend logs during `generateTopicNotes` to confirm the prompt payload is significantly smaller (reduced token count) and only contains relevant chunks from Pinecone.
- Refresh the application and ensure past jobs load instantly from the SQLite database.
