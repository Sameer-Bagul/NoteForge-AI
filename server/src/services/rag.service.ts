import { ChatOllama, OllamaEmbeddings } from "@langchain/ollama";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { PineconeStore } from "@langchain/pinecone";
import { Pinecone as PineconeClient } from "@pinecone-database/pinecone";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { Document } from "@langchain/core/documents";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { BM25Retriever } from "@langchain/community/retrievers/bm25";
import { EnsembleRetriever } from "langchain/retrievers/ensemble";
import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { VideoTranscript } from "../types/index.js";
import { getSettings } from "./multi-llm.service.js";

// Define the State for the LangGraph Agent
const GraphState = Annotation.Root({
    topic: Annotation<string>(),
    optimizedQuery: Annotation<string>(),
    context: Annotation<string>(),
    draftAnswer: Annotation<string>(),
    finalAnswer: Annotation<string>(),
    hasHallucinations: Annotation<boolean>(),
    loopCount: Annotation<number>({ reducer: (a, b) => b, default: () => 0 }),
    onProgress: Annotation<any>(), // Function to report progress
});

export class RAGService {
    private llm: ChatOllama;
    private embeddings: OllamaEmbeddings;
    private vectorStore?: any; // MemoryVectorStore | PineconeStore
    private retriever?: EnsembleRetriever;
    private ragChain?: any;
    private pineconeClient?: PineconeClient;

    constructor() {
        this.llm = new ChatOllama({
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

        const allDocs: Document[] = [];
        
        // Semantic Timestamp Chunking
        for (const t of transcripts) {
            let currentChunkText = "";
            let chunkStartTime = 0;
            
            for (let i = 0; i < t.segments.length; i++) {
                const seg = t.segments[i];
                if (currentChunkText === "") chunkStartTime = seg.start;
                
                currentChunkText += seg.text + " ";
                
                // Group segments into ~800 character chunks or if it's the last segment
                if (currentChunkText.length >= 800 || i === t.segments.length - 1) {
                    const minutes = Math.floor(chunkStartTime / 60);
                    const seconds = Math.floor(chunkStartTime % 60);
                    const timestampStr = `[${minutes}:${seconds.toString().padStart(2, '0')}]`;
                    
                    allDocs.push(new Document({
                        pageContent: `${timestampStr} ${currentChunkText.trim()}`,
                        metadata: {
                            videoId: t.videoId,
                            title: t.videoInfo.title,
                            source: 'youtube',
                            timestamp: chunkStartTime,
                            timestampStr
                        }
                    }));
                    currentChunkText = "";
                }
            }
        }

        if (onProgress) onProgress(`Created ${allDocs.length} timestamped chunks.`);
        console.log(`[RAG] Created ${allDocs.length} chunks.`);

        // Initialize Vector Store (Pinecone or Memory)
        const settings = getSettings();
        if (settings.pineconeApiKey && settings.pineconeIndex) {
            if (onProgress) onProgress("Connecting to Pinecone Cloud Storage...");
            console.log("[RAG] Initializing Pinecone Store...");
            try {
                this.pineconeClient = new PineconeClient({ apiKey: settings.pineconeApiKey });
                const pineconeIndex = this.pineconeClient.Index(settings.pineconeIndex);
                this.vectorStore = await PineconeStore.fromDocuments(allDocs, this.embeddings, {
                    pineconeIndex,
                    maxConcurrency: 5,
                });
            } catch (err) {
                console.error("[RAG] Pinecone init failed. Falling back to Memory.", err);
                if (onProgress) onProgress("Pinecone connection failed. Falling back to local memory.");
                this.vectorStore = await MemoryVectorStore.fromDocuments(allDocs, this.embeddings);
            }
        } else {
            this.vectorStore = await MemoryVectorStore.fromDocuments(allDocs, this.embeddings);
        }

        const vectorRetriever = this.vectorStore.asRetriever({ k: 20 });
        const bm25Retriever = await BM25Retriever.fromDocuments(allDocs, { k: 20 });

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
     * LangGraph Agentic Workflow Nodes
     */
    private async rewriteNode(state: typeof GraphState.State) {
        if (state.onProgress) state.onProgress("Agent: Transforming query for better retrieval...");
        const rewritePrompt = `Transform this user topic into a search query suitable for finding relevant sections in a video transcript. Return ONLY the search query. Topic: ${state.topic}`;
        const response = await this.llm.invoke(rewritePrompt);
        return { optimizedQuery: (response.content as string).trim() };
    }

    private async retrieveAndDraftNode(state: typeof GraphState.State) {
        if (state.onProgress) state.onProgress("Agent: Retrieving context & drafting answer...");
        if (!this.ragChain) throw new Error("RAG Chain not initialized");
        
        const result = await this.ragChain.invoke({ input: state.optimizedQuery });
        return { 
            draftAnswer: result.answer, 
            context: result.context.map((d: any) => d.pageContent).join('\n---\n') 
        };
    }

    private async critiqueNode(state: typeof GraphState.State) {
        if (state.onProgress) state.onProgress("Agent: Self-critiquing draft for hallucinations...");
        const verifyPrompt = `
            Context from Video Transcripts:
            ${state.context}
            
            Draft Note:
            ${state.draftAnswer}
            
            CHECKLIST FOR VERIFICATION:
            1. Is every claim in the Draft Note strictly supported by the Context?
            2. Are there any hallucinations (info NOT in the context)?
            
            Respond strictly in JSON format:
            {
               "hasHallucinations": boolean,
               "verifiedNote": "the corrected note strictly grounded in context, or the exact draft if accurate"
            }
        `;
        
        try {
            // Force JSON format for parsing
            const llmJson = this.llm.bind({ format: "json" });
            const finalNote = await llmJson.invoke(verifyPrompt);
            const parsed = JSON.parse(finalNote.content as string);
            
            return {
                hasHallucinations: parsed.hasHallucinations,
                finalAnswer: parsed.verifiedNote,
                loopCount: state.loopCount + 1
            };
        } catch (err) {
            console.error("[RAG Agent] Critique JSON parse failed, bypassing:", err);
            return {
                hasHallucinations: false,
                finalAnswer: state.draftAnswer,
                loopCount: state.loopCount + 1
            };
        }
    }

    private shouldLoop(state: typeof GraphState.State) {
        // If hallucinations are found and we haven't looped too many times, re-retrieve.
        if (state.hasHallucinations && state.loopCount < 2) {
            if (state.onProgress) state.onProgress("Agent: Hallucinations detected! Retrying retrieval...");
            return "rewriteNode"; // Route back to the start
        }
        return END; // Otherwise finish
    }

    /**
     * Retrieve context and generate answer using LangGraph
     */
    async generateGroundedNotes(topic: string, transcripts: VideoTranscript[], onProgress?: (msg: string) => void): Promise<string> {
        if (!this.ragChain) {
            await this.indexTranscripts(transcripts, onProgress);
        }

        // Define the StateGraph Workflow
        const workflow = new StateGraph(GraphState)
            .addNode("rewriteNode", this.rewriteNode.bind(this))
            .addNode("retrieveAndDraftNode", this.retrieveAndDraftNode.bind(this))
            .addNode("critiqueNode", this.critiqueNode.bind(this))
            .addEdge(START, "rewriteNode")
            .addEdge("rewriteNode", "retrieveAndDraftNode")
            .addEdge("retrieveAndDraftNode", "critiqueNode")
            .addConditionalEdges("critiqueNode", this.shouldLoop.bind(this));

        const app = workflow.compile();

        if (onProgress) onProgress("Agent: Starting autonomous workflow...");
        const finalState = await app.invoke({
            topic,
            loopCount: 0,
            hasHallucinations: false,
            onProgress
        });

        if (onProgress) onProgress("Agent: Workflow complete.");
        return finalState.finalAnswer || finalState.draftAnswer || "";
    }

    /**
     * Manual context retrieval if needed
     */
    async retrieveContext(query: string, transcripts: VideoTranscript[], onProgress?: (msg: string) => void, k: number = 20): Promise<string> {
        if (!this.retriever) {
            await this.indexTranscripts(transcripts, onProgress);
        }

        if (onProgress) onProgress("Retrieving dense context...");
        const rewritePrompt = `Transform this user topic into a search query suitable for finding relevant sections in a video transcript. Return ONLY the search query. Topic: ${query}`;
        const response = await this.llm.invoke(rewritePrompt);
        const optimizedQuery = (response.content as string).trim();
        
        const docs = await this.retriever!.getRelevantDocuments(optimizedQuery);
        const selectedDocs = docs.slice(0, k);
        return selectedDocs.map(d => `[Source: ${d.metadata.title}] ${d.pageContent}`).join('\n\n---\n\n');
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
