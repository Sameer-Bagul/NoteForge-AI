# Phase 2: Hybrid AI Architecture & Enterprise Resilience

Based on expert suggestions, we have heavily optimized our Phase 2 plan. The core focus is on bulletproof persistence (resuming jobs exactly where they left off) and dropping unnecessary complex tech (like Vector DBs) in favor of fast, deterministic code.

## Phase 2.1: SQLite Migration & Bulletproof Resumption (Highest Priority)
Without a database, a laptop shutdown or API quota error destroys hours of processing. We will introduce Prisma ORM and SQLite.
- **Granular Job Schema:** We will track `currentVideo` and `currentChapter` in the database. 
- **Why?** If a video has 15 chapters and the API fails on Chapter 12, the system will pause. When you click "Play" tomorrow, it will instantly resume at Chapter 12 without re-processing the first 11 chapters.

## Phase 2.2: Single-Shot JSON Generation
Right now, the app separates Notes, Mindmaps, Quizzes, and Interview Q&As into separate generation cycles.
- **Unified Prompts:** We will update the LLM prompt to generate Deep Study Notes, Flashcards, and Quizzes in a **single JSON API call**. 
- **Why?** Combining 4 API calls into 1 cuts our RPM (Requests Per Minute) by massive amounts, speeding up assembly and saving quota.

## Phase 2.3: Adaptive Backoff & Smart Key Rotation
We will abandon the hardcoded "7-second delay" and implement adaptive throttling.
- **Exponential Backoff:** The system runs fast (e.g., 2s delay). If we receive a `429 RESOURCE_EXHAUSTED` error, the cooldown instantly doubles (4s -> 8s -> 16s) until it succeeds, then resets.
- **Smart Key Pool:** The settings will accept multiple API keys. If a key is completely exhausted, the system marks it with an `exhaustedUntil` timestamp (disabling it until tomorrow) and seamlessly switches to the next available key.

## Phase 2.4: Deterministic Chunking (Removing Pinecone)
We previously considered using Pinecone and RAG to filter large transcripts. This was overkill.
- **Timestamp Slicing:** Since we already know the start and end timestamps of every chapter, we don't need AI or Vector Search to find the relevant transcript chunk! We will simply use Javascript to slice the exact lines of transcript that fall within the chapter's timestamps. 
- **Why?** This is 100% free, takes zero milliseconds, and requires zero external databases. It drops token usage massively without any AI overhead.

---

## What about Phase 3? (Future Scope)
Once Phase 2 is stable, Phase 3 will introduce **Master Course Synthesis**. After all chapters of a playlist finish, the AI will perform one massive synthesis pass to generate:
- A One-Page Cheat Sheet
- Final Exam/Interview Revision Notes
- A Master Course Summary
