import { Ollama, OllamaEmbeddings } from "@langchain/ollama";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { Document } from "@langchain/core/documents";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { BM25Retriever } from "@langchain/community/retrievers/bm25";
import { EnsembleRetriever } from "langchain/retrievers/ensemble";
import { VideoTranscript } from "../types";

export class RAGService {
    private llm: Ollama;
    private embeddings: OllamaEmbeddings;
    private vectorStore?: MemoryVectorStore;
    private retriever?: EnsembleRetriever;
    private ragChain?: any;

    constructor() {
        this.llm = new Ollama({
            model: process.env.OLLAMA_MODEL || 'llama3.1',
            baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
            temperature: 0
        });
        this.embeddings = new OllamaEmbeddings({
            model: process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text',
            baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
        });
    }

    /**
     * Build the RAG index from transcripts
     */
    async indexTranscripts(transcripts: VideoTranscript[], onProgress?: (msg: string) => void) {
        if (onProgress) onProgress(`Indexing ${transcripts.length} transcripts...`);
        console.log(`[RAG] Indexing ${transcripts.length} transcripts...`);

        const allDocs = transcripts.map(t => new Document({
            pageContent: t.fullText,
            metadata: {
                videoId: t.videoId,
                title: t.videoInfo.title,
                source: 'youtube'
            }
        }));

        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200
        });

        const splitDocs = await splitter.splitDocuments(allDocs);
        if (onProgress) onProgress(`Split into ${splitDocs.length} chunks.`);
        console.log(`[RAG] Split into ${splitDocs.length} chunks.`);

        this.vectorStore = await MemoryVectorStore.fromDocuments(splitDocs, this.embeddings);

        const vectorRetriever = this.vectorStore.asRetriever({ k: 4 });
        const bm25Retriever = await BM25Retriever.fromDocuments(splitDocs, { k: 4 });

        this.retriever = new EnsembleRetriever({
            retrievers: [vectorRetriever as any, bm25Retriever as any],
            weights: [0.5, 0.5]
        });

        const prompt = ChatPromptTemplate.fromTemplate(`
            Answer the following question based only on the provided context. 
            If the answer is not in the context, say "I don't know based on the video context".
            
            Context: {context}
            Question: {input}
            Answer:
        `);

        const combineDocsChain = await createStuffDocumentsChain({
            llm: this.llm as any,
            prompt: prompt as any,
        });

        this.ragChain = await createRetrievalChain({
            combineDocsChain,
            retriever: this.retriever,
        });

        if (onProgress) onProgress("Indexing complete.");
        console.log("[RAG] Indexing complete.");
    }

    /**
     * Transform query for better retrieval
     */
    async rewriteQuery(query: string): Promise<string> {
        const rewritePrompt = `Transform this user topic into a search query suitable for finding relevant sections in a video transcript. Return ONLY the search query.
        Topic: ${query}`;

        const response = await this.llm.invoke(rewritePrompt);
        return response.trim();
    }

    /**
     * Retrieve context and generate answer with self-correction
     */
    async generateGroundedNotes(topic: string, transcripts: VideoTranscript[], onProgress?: (msg: string) => void): Promise<string> {
        // If the context is new or different, we should potentially re-index
        // For simplicity in this master implementation, we re-index if not already done
        if (!this.ragChain) {
            await this.indexTranscripts(transcripts, onProgress);
        }

        // 1. Rewrite query
        if (onProgress) onProgress("Transforming query...");
        const optimizedQuery = await this.rewriteQuery(topic);

        // 2. Generate initial answer
        if (onProgress) onProgress("Retrieving context & generating draft...");
        const result = await this.ragChain.invoke({ input: optimizedQuery });
        const draftAnswer = result.answer;
        const context = result.context.map((d: any) => d.pageContent).join('\n---\n');

        // 3. Self-correction loop
        const verifyPrompt = `
            Context from Video Transcripts:
            ${context}
            
            Draft Note:
            ${draftAnswer}
            
            CHECKLIST FOR VERIFICATION:
            1. Is every claim in the Draft Note supported by the Context?
            2. Are there any hallucinations (info NOT in the context)?
            
            If the note is accurate, repeat it exactly.
            If there are hallucinations, rewrite it to be strictly grounded in the context.
            
            Verified Note:
        `;

        if (onProgress) onProgress("Verifying & self-correcting draft...");
        const finalNote = await this.llm.invoke(verifyPrompt);
        return finalNote.trim();
    }

    /**
     * Manual context retrieval if needed
     */
    async retrieveContext(query: string, transcripts: VideoTranscript[], onProgress?: (msg: string) => void): Promise<string> {
        if (!this.retriever) {
            await this.indexTranscripts(transcripts, onProgress);
        }

        if (onProgress) onProgress("Retrieving relevant context...");
        const optimizedQuery = await this.rewriteQuery(query);
        const docs = await this.retriever!.getRelevantDocuments(optimizedQuery);
        return docs.map(d => `[Source: ${d.metadata.title}]\n${d.pageContent}`).join('\n\n---\n\n');
    }

    /**
     * Clear the current index to prepare for a new set of transcripts
     */
    clearIndex() {
        this.vectorStore = undefined;
        this.retriever = undefined;
        this.ragChain = undefined;
        console.log("[RAG] Index cleared.");
    }
}

export const ragService = new RAGService();
